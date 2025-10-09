const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const SSHManager = require('../config/SSHManager');

const router = express.Router();

// GET /api/dados-conexao/obs-config - Configuração para OBS
router.get('/obs-config', authMiddleware, async (req, res) => {
  try {
    // Para revendas, usar o ID efetivo do usuário
    const userId = req.user.effective_user_id || req.user.id;
    const userLogin = req.user.usuario || `user_${userId}`;
    
    // Buscar configurações do usuário
    const [userConfigRows] = await db.execute(
      `SELECT 
        bitrate, espectadores, espaco, espaco_usado, aplicacao,
        status_gravando, transcoder, transcoder_qualidades, codigo_servidor
       FROM streamings 
       WHERE (codigo_cliente = ? OR codigo_cliente = ?) AND status = 1 LIMIT 1`,
      [userId, userId]
    );

    // Se não encontrou em streamings e é revenda, buscar dados da revenda
    if (userConfigRows.length === 0 && req.user.tipo === 'revenda') {
      const [revendaRows] = await db.execute(
        `SELECT  
          bitrate, espectadores, espaco, 0 as espaco_usado, 'live' as aplicacao,
          'nao' as status_gravando, 'nao' as transcoder, '' as transcoder_qualidades, 1 as codigo_servidor
         FROM revendas 
         WHERE codigo = ? AND status = 1 LIMIT 1`,
        [userId]
      );
      
      if (revendaRows.length > 0) {
        userConfigRows.push(revendaRows[0]);
      }
    }
    if (userConfigRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Configurações do usuário não encontradas' 
      });
    }

    const userConfig = userConfigRows[0];
    
    // Buscar servidor do usuário através das pastas
    const [serverRows] = await db.execute(
      'SELECT servidor_id FROM folders WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const serverId = serverRows.length > 0 ? serverRows[0].servidor_id : (userConfig.codigo_servidor || 1);

    // Buscar informações do servidor
    const [wowzaServerRows] = await db.execute(
      `SELECT 
        codigo, nome, limite_streamings, streamings_ativas, 
        load_cpu, tipo_servidor, status
       FROM wowza_servers 
       WHERE codigo = ?`,
      [serverId]
    );

    const serverInfo = wowzaServerRows.length > 0 ? wowzaServerRows[0] : null;

    // Verificar se há bitrate solicitado na requisição
    const requestedBitrate = req.query.bitrate ? parseInt(req.query.bitrate) : null;
    const maxBitrate = userConfig.bitrate || 2500;
    const allowedBitrate = requestedBitrate ? Math.min(requestedBitrate, maxBitrate) : maxBitrate;

    // Garantir que o diretório do usuário existe no servidor (sem cooldown)
    try {
      const userPath = `/home/streaming/${userLogin}`;
      const pathExists = await SSHManager.checkDirectoryExists(serverId, userPath);
      
      if (!pathExists) {
        console.log(`📁 Criando estrutura para usuário ${userLogin} no servidor ${serverId}`);
        await SSHManager.createCompleteUserStructure(serverId, userLogin, {
          bitrate: userConfig.bitrate || 2500,
          espectadores: userConfig.espectadores || 100,
          status_gravando: userConfig.status_gravando || 'nao'
        });
      }
    } catch (dirError) {
      console.warn('Aviso: Erro ao verificar/criar diretório do usuário:', dirError.message);
    }

    // Verificar se há transmissão OBS ativa via API Wowza
    let obsStreamActive = false;
    let obsStreamInfo = null;
    try {
      const WowzaStreamingService = require('../config/WowzaStreamingService');
      const incomingStreamsResult = await WowzaStreamingService.checkUserIncomingStreams(userId);
      
      if (incomingStreamsResult.hasActiveStreams) {
        obsStreamActive = true;
        const activeStream = incomingStreamsResult.activeStreams[0];
        obsStreamInfo = {
          streamName: activeStream.name,
          viewers: activeStream.connectionsCurrent || 0,
          bitrate: Math.floor((activeStream.messagesInBytesRate || 0) / 1000),
          uptime: WowzaStreamingService.formatUptime(activeStream.timeRunning || 0),
          sourceIp: activeStream.sourceIp || 'N/A'
        };
      }
    } catch (wowzaError) {
      console.warn('Erro ao verificar Wowza API:', wowzaError.message);
    }
    // Verificar limites e gerar avisos
    const warnings = [];
    if (requestedBitrate && requestedBitrate > maxBitrate) {
      warnings.push(`Bitrate solicitado (${requestedBitrate} kbps) excede o limite do plano (${maxBitrate} kbps). Será limitado automaticamente.`);
    }
    if (serverInfo && serverInfo.streamings_ativas >= serverInfo.limite_streamings * 0.9) {
      warnings.push('Servidor próximo do limite de capacidade');
    }
    if (serverInfo && serverInfo.load_cpu > 80) {
      warnings.push('Servidor com alta carga de CPU');
    }
    if (!obsStreamActive && !incomingStreamsResult?.success) {
      warnings.push('Wowza API indisponível - verificação de stream limitada');
    }
    
    const usedSpace = userConfig.espaco_usado || 0;
    const totalSpace = userConfig.espaco || 1000;
    const storagePercentage = Math.round((usedSpace / totalSpace) * 100);
    
    if (storagePercentage > 90) {
      warnings.push('Espaço de armazenamento quase esgotado');
    }

    // Configurar URLs baseadas no ambiente
    // Usar domínio oficial do servidor Wowza
    const wowzaHost = 'stmv1.udicast.com';
    
    res.json({
      success: true,
      obs_config: {
        rtmp_url: `rtmp://${wowzaHost}:1935/${userLogin}`,
        stream_key: 'live',
        stream_name: 'live',
        hls_url: `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`,
        hls_http_url: `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`,
        dash_url: `https://${wowzaHost}/${userLogin}/${userLogin}/manifest.mpd`,
        rtsp_url: `rtsp://${wowzaHost}:554/${userLogin}/${userLogin}`,
        max_bitrate: allowedBitrate,
        max_viewers: userConfig.espectadores,
        recording_enabled: userConfig.status_gravando === 'sim',
        recording_path: `/home/streaming/${userLogin}/recordings/`,
        // Dados para FMLE
        fmle_server: `rtmp://${wowzaHost}:1935/${userLogin}`,
        fmle_stream: 'live',
        fmle_username: userLogin,
        fmle_password: 'teste2025', // Senha padrão do usuário
        // URLs para SMIL (playlists)
        smil_hls_url: `https://${wowzaHost}/${userLogin}/smil:playlists_agendamentos.smil/playlist.m3u8`,
        smil_hls_http_url: `https://${wowzaHost}/${userLogin}/smil:playlists_agendamentos.smil/playlist.m3u8`,
        smil_rtmp_url: `rtmp://${wowzaHost}:1935/${userLogin}/smil:playlists_agendamentos.smil`,
        smil_rtsp_url: `rtsp://${wowzaHost}:554/${userLogin}/smil:playlists_agendamentos.smil`,
        smil_dash_url: `https://${wowzaHost}/${userLogin}/smil:playlists_agendamentos.smil/manifest.mpd`
      },
      user_limits: {
        bitrate: {
          max: maxBitrate,
          requested: requestedBitrate || maxBitrate,
          allowed: allowedBitrate
        },
        viewers: {
          max: userConfig.espectadores || 100
        },
        storage: {
          max: totalSpace,
          used: usedSpace,
          available: totalSpace - usedSpace,
          percentage: storagePercentage
        }
      },
      obs_stream_status: {
        is_active: obsStreamActive,
        stream_info: obsStreamInfo,
        wowza_connection: incomingStreamsResult?.success || false
      },
      warnings: warnings,
      server_info: serverInfo,
      wowza_status: warnings.some(w => w.includes('Wowza API indisponível')) ? 'degraded' : 'online'
    });
  } catch (error) {
    console.error('Erro ao obter configuração OBS:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// GET /api/dados-conexao/fmle-profile - Download do profile FMLE
router.get('/fmle-profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.effective_user_id || req.user.id;
    const userLogin = req.user.usuario || `user_1`;
    const userBitrate = req.user.bitrate || 2500;
    const userPassword = 'teste2025'; // Senha padrão do usuário

    // Gerar XML do profile FMLE personalizado
    const profileXml = `<?xml version="1.0" encoding="UTF-8"?>
<FMLEDocument version="2.0">
  <FMLEProfile>
    <VideoDevice>
      <Name>Screen Capture</Name>
      <CaptureWidth>1920</CaptureWidth>
      <CaptureHeight>1080</CaptureHeight>
      <CaptureFrameRate>30</CaptureFrameRate>
    </VideoDevice>
    
    <AudioDevice>
      <Name>Default Audio Device</Name>
      <SampleRate>44100</SampleRate>
      <Channels>2</Channels>
    </AudioDevice>
    
    <VideoEncoder>
      <Codec>H.264</Codec>
      <Bitrate>${Math.floor(userBitrate * 0.8)}</Bitrate>
      <Quality>High</Quality>
      <KeyFrameInterval>2</KeyFrameInterval>
      <Width>1920</Width>
      <Height>1080</Height>
      <FrameRate>30</FrameRate>
    </VideoEncoder>
    
    <AudioEncoder>
      <Codec>AAC</Codec>
      <Bitrate>${Math.floor(userBitrate * 0.2)}</Bitrate>
      <SampleRate>44100</SampleRate>
      <Channels>2</Channels>
    </AudioEncoder>
    
    <Output>
      <Format>FLV</Format>
      <URL>rtmp://stmv1.udicast.com:1935/${userLogin}</URL>
      <Stream>live</Stream>
      <Username>${userLogin}</Username>
      <Password>${userPassword}</Password>
    </Output>
    
    <Settings>
      <BufferTime>3</BufferTime>
      <ConnectTimeout>30</ConnectTimeout>
      <ReconnectAttempts>5</ReconnectAttempts>
      <ReconnectInterval>10</ReconnectInterval>
    </Settings>
  </FMLEProfile>
</FMLEDocument>`;
    // Configurar headers para download
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="profile_fmle_${userLogin}.xml"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.send(profileXml);
  } catch (error) {
    console.error('Erro ao gerar profile FMLE:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

module.exports = router;