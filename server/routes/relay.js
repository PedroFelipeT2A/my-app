import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';
import { NodeSSH } from 'node-ssh';
import fetch from 'node-fetch';

const router = express.Router();
const ssh = new NodeSSH();

// GET /api/relay/status - Verificar status do relay
router.get('/status', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: stream, error } = await supabase
      .from('streams')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!stream) {
      return res.json({
        relay_status: 'inativo',
        relay_url: '',
        relay_type: 'rtmp',
        is_live: false,
        viewers: 0,
        bitrate: 0,
        uptime: '00:00:00'
      });
    }

    res.json({
      id: stream.id,
      relay_status: stream.relay_status || 'inativo',
      relay_url: stream.relay_url || '',
      relay_type: stream.relay_type || 'rtmp',
      relay_error_details: stream.relay_error_details,
      relay_started_at: stream.relay_started_at,
      is_live: stream.is_live,
      viewers: stream.viewers,
      bitrate: stream.bitrate,
      uptime: stream.uptime
    });
  } catch (err) {
    console.error('Erro ao verificar status do relay:', err);
    res.status(500).json({ error: 'Erro ao verificar status do relay', details: err.message });
  }
});

// POST /api/relay/validate-url - Validar URL do relay
router.post('/validate-url', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.json({ valid: false, message: 'URL é obrigatória' });
    }

    // Verificar se é M3U8
    if (url.includes('.m3u8')) {
      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; StreamRelay/1.0)'
          }
        });
        
        const isValid = response.ok && response.status === 200;
        
        res.json({
          valid: isValid,
          message: isValid ? 'URL M3U8 acessível' : `URL retornou status ${response.status}`,
          status: response.status
        });
      } catch (error) {
        res.json({
          valid: false,
          message: 'URL M3U8 inacessível ou offline',
          error: error.message
        });
      }
    }
    // Verificar se é RTMP
    else if (url.startsWith('rtmp://')) {
      // Para RTMP, apenas validamos o formato da URL
      const rtmpRegex = /^rtmp:\/\/[^\/]+\/[^\/]+\/?.*/;
      const isValid = rtmpRegex.test(url);
      
      res.json({
        valid: isValid,
        message: isValid ? 'Formato RTMP válido' : 'Formato RTMP inválido'
      });
    }
    else {
      res.json({
        valid: false,
        message: 'URL deve ser RTMP (rtmp://) ou M3U8 (https://...m3u8)'
      });
    }
  } catch (err) {
    console.error('Erro ao validar URL:', err);
    res.status(500).json({ 
      valid: false, 
      message: 'Erro ao validar URL',
      error: err.message 
    });
  }
});

// POST /api/relay/start - Iniciar relay
router.post('/start', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { relay_url, relay_type = 'rtmp', server_id } = req.body;

    if (!relay_url) {
      return res.status(400).json({ error: 'URL do relay é obrigatória' });
    }

    // Verificar se já existe um relay ativo
    const { data: existingStream } = await supabase
      .from('streams')
      .select('*')
      .eq('user_id', userId)
      .eq('relay_status', 'ativo')
      .single();

    if (existingStream) {
      return res.status(400).json({ error: 'Já existe um relay ativo. Desative-o primeiro.' });
    }

    // Buscar dados do usuário para obter login
    const { data: user } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    const userLogin = user.user?.email?.split('@')[0] || 'usuario';

    // Buscar servidor (usar padrão se não especificado)
    let serverData = {
      ip: '51.222.156.223',
      porta_ssh: 22,
      usuario_ssh: 'root',
      senha_ssh: 'FK38Ca2SuE6jvJXed97VMn'
    };

    if (server_id) {
      const { data: server } = await supabase
        .from('servers')
        .select('*')
        .eq('id', server_id)
        .single();
      
      if (server) {
        serverData = {
          ip: server.ip,
          porta_ssh: server.porta_ssh,
          usuario_ssh: server.usuario_ssh,
          senha_ssh: server.senha_ssh
        };
      }
    }

    try {
      // Conectar via SSH
      await ssh.connect({
        host: serverData.ip,
        port: serverData.porta_ssh,
        username: serverData.usuario_ssh,
        password: serverData.senha_ssh
      });

      // Parar relay existente se houver
      await ssh.execCommand(`screen -ls | grep -o '[0-9]*\\.${userLogin}_relay' | xargs -I{} screen -X -S {} quit`);
      
      // Aguardar um pouco
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Construir comando FFmpeg
      const streamKey = userLogin;
      const rtmpOutput = `rtmp://localhost:1935/${userLogin}/${streamKey}`;
      
      let ffmpegCmd;
      if (relay_type === 'm3u8') {
        ffmpegCmd = `/usr/local/bin/ffmpeg -re -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 2 -i '${relay_url}' -c:v copy -c:a copy -bsf:a aac_adtstoasc -preset medium -threads 1 -f flv '${rtmpOutput}'`;
      } else {
        ffmpegCmd = `/usr/local/bin/ffmpeg -re -i '${relay_url}' -c:v copy -c:a copy -bsf:a aac_adtstoasc -preset medium -threads 1 -f flv '${rtmpOutput}'`;
      }

      // Iniciar relay em screen
      const screenCmd = `screen -dmS ${userLogin}_relay bash -c '${ffmpegCmd}; exec sh'`;
      await ssh.execCommand(screenCmd);

      // Aguardar inicialização
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Verificar se o stream está ativo
      const checkCmd = `screen -ls | grep ${userLogin}_relay`;
      const { stdout: screenCheck } = await ssh.execCommand(checkCmd);
      
      const isActive = screenCheck.includes(`${userLogin}_relay`);

      if (isActive) {
        // Criar ou atualizar registro do stream
        const { data: stream, error: streamError } = await supabase
          .from('streams')
          .upsert({
            user_id: userId,
            is_live: true,
            viewers: 0,
            bitrate: 2500,
            uptime: '00:00:00',
            relay_status: 'ativo',
            relay_url,
            relay_type,
            relay_started_at: new Date().toISOString(),
            relay_error_details: null,
            wowza_stream_name: `${userLogin}_relay`,
            wowza_application: userLogin
          }, {
            onConflict: 'user_id'
          })
          .select()
          .single();

        if (streamError) throw streamError;

        ssh.dispose();

        res.json({
          success: true,
          message: 'Relay ativado com sucesso',
          stream
        });
      } else {
        // Falha ao iniciar
        await supabase
          .from('streams')
          .upsert({
            user_id: userId,
            relay_status: 'erro',
            relay_url,
            relay_type,
            relay_error_details: 'Falha ao iniciar processo FFmpeg'
          }, {
            onConflict: 'user_id'
          });

        ssh.dispose();

        res.status(500).json({
          success: false,
          error: 'Falha ao ativar relay. Verifique se a URL está correta.'
        });
      }
    } catch (sshError) {
      console.error('Erro SSH:', sshError);
      
      await supabase
        .from('streams')
        .upsert({
          user_id: userId,
          relay_status: 'erro',
          relay_url,
          relay_type,
          relay_error_details: `Erro SSH: ${sshError.message}`
        }, {
          onConflict: 'user_id'
        });

      ssh.dispose();

      res.status(500).json({
        success: false,
        error: 'Erro de conexão com o servidor'
      });
    }
  } catch (err) {
    console.error('Erro ao iniciar relay:', err);
    res.status(500).json({ error: 'Erro ao iniciar relay', details: err.message });
  }
});

// POST /api/relay/stop - Parar relay
router.post('/stop', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar dados do usuário para obter login
    const { data: user } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    const userLogin = user.user?.email?.split('@')[0] || 'usuario';

    // Buscar dados do stream
    const { data: stream } = await supabase
      .from('streams')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!stream || stream.relay_status !== 'ativo') {
      return res.status(400).json({ error: 'Nenhum relay ativo encontrado' });
    }

    // Buscar servidor
    let serverData = {
      ip: '51.222.156.223',
      porta_ssh: 22,
      usuario_ssh: 'root',
      senha_ssh: 'FK38Ca2SuE6jvJXed97VMn'
    };

    if (stream.server_id) {
      const { data: server } = await supabase
        .from('servers')
        .select('*')
        .eq('id', stream.server_id)
        .single();
      
      if (server) {
        serverData = {
          ip: server.ip,
          porta_ssh: server.porta_ssh,
          usuario_ssh: server.usuario_ssh,
          senha_ssh: server.senha_ssh
        };
      }
    }

    try {
      // Conectar via SSH
      await ssh.connect({
        host: serverData.ip,
        port: serverData.porta_ssh,
        username: serverData.usuario_ssh,
        password: serverData.senha_ssh
      });

      // Parar relay
      await ssh.execCommand(`screen -ls | grep -o '[0-9]*\\.${userLogin}_relay' | xargs -I{} screen -X -S {} quit`);

      ssh.dispose();

      // Atualizar status no banco
      await supabase
        .from('streams')
        .update({
          relay_status: 'inativo',
          is_live: false,
          relay_error_details: null
        })
        .eq('user_id', userId);

      res.json({
        success: true,
        message: 'Relay desativado com sucesso'
      });
    } catch (sshError) {
      console.error('Erro SSH ao parar relay:', sshError);
      ssh.dispose();

      // Mesmo com erro SSH, marcar como inativo no banco
      await supabase
        .from('streams')
        .update({
          relay_status: 'inativo',
          is_live: false,
          relay_error_details: `Erro ao parar: ${sshError.message}`
        })
        .eq('user_id', userId);

      res.json({
        success: true,
        message: 'Relay marcado como inativo (possível erro de conexão SSH)'
      });
    }
  } catch (err) {
    console.error('Erro ao parar relay:', err);
    res.status(500).json({ error: 'Erro ao parar relay', details: err.message });
  }
});

export default router;