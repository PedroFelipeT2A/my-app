const express = require('express');
const router = express.Router();
const StreamingControlService = require('../services/StreamingControlService');
const authMiddleware = require('../middlewares/authMiddleware');

// Middleware de autenticação
router.use(authMiddleware);

/**
 * POST /api/streaming-control/ligar
 * Ligar streaming
 */
router.post('/ligar', async (req, res) => {
    try {
        const { login } = req.body;

        if (!login) {
            return res.status(400).json({
                success: false,
                message: 'Login do streaming é obrigatório'
            });
        }

        const result = await StreamingControlService.ligarStreaming(login);

        if (result.success) {
            return res.json(result);
        } else {
            return res.status(result.alreadyActive ? 200 : 500).json(result);
        }

    } catch (error) {
        console.error('Erro ao ligar streaming:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao ligar streaming',
            error: error.message
        });
    }
});

/**
 * POST /api/streaming-control/desligar
 * Desligar streaming
 */
router.post('/desligar', async (req, res) => {
    try {
        const { login } = req.body;

        if (!login) {
            return res.status(400).json({
                success: false,
                message: 'Login do streaming é obrigatório'
            });
        }

        const result = await StreamingControlService.desligarStreaming(login);

        if (result.success) {
            return res.json(result);
        } else {
            return res.status(result.alreadyInactive ? 200 : 500).json(result);
        }

    } catch (error) {
        console.error('Erro ao desligar streaming:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao desligar streaming',
            error: error.message
        });
    }
});

/**
 * POST /api/streaming-control/reiniciar
 * Reiniciar streaming
 */
router.post('/reiniciar', async (req, res) => {
    try {
        const { login } = req.body;

        if (!login) {
            return res.status(400).json({
                success: false,
                message: 'Login do streaming é obrigatório'
            });
        }

        const result = await StreamingControlService.reiniciarStreaming(login);

        if (result.success) {
            return res.json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('Erro ao reiniciar streaming:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao reiniciar streaming',
            error: error.message
        });
    }
});

/**
 * POST /api/streaming-control/bloquear
 * Bloquear streaming (apenas admin/revenda)
 */
router.post('/bloquear', async (req, res) => {
    try {
        const { login } = req.body;
        const userType = req.user?.type || req.user?.tipo;

        if (!login) {
            return res.status(400).json({
                success: false,
                message: 'Login do streaming é obrigatório'
            });
        }

        if (!userType || (userType !== 'admin' && userType !== 'revenda')) {
            return res.status(403).json({
                success: false,
                message: 'Acesso não autorizado'
            });
        }

        const result = await StreamingControlService.bloquearStreaming(login, userType);

        if (result.success) {
            return res.json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('Erro ao bloquear streaming:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao bloquear streaming',
            error: error.message
        });
    }
});

/**
 * POST /api/streaming-control/desbloquear
 * Desbloquear streaming (apenas admin/revenda)
 */
router.post('/desbloquear', async (req, res) => {
    try {
        const { login } = req.body;
        const userType = req.user?.type || req.user?.tipo;

        if (!login) {
            return res.status(400).json({
                success: false,
                message: 'Login do streaming é obrigatório'
            });
        }

        if (!userType || (userType !== 'admin' && userType !== 'revenda')) {
            return res.status(403).json({
                success: false,
                message: 'Acesso não autorizado'
            });
        }

        const result = await StreamingControlService.desbloquearStreaming(login, userType);

        if (result.success) {
            return res.json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('Erro ao desbloquear streaming:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao desbloquear streaming',
            error: error.message
        });
    }
});

/**
 * DELETE /api/streaming-control/remover
 * Remover streaming (apenas admin/revenda)
 */
router.delete('/remover', async (req, res) => {
    try {
        const { login } = req.body;
        const userType = req.user?.type || req.user?.tipo;

        if (!login) {
            return res.status(400).json({
                success: false,
                message: 'Login do streaming é obrigatório'
            });
        }

        if (!userType || (userType !== 'admin' && userType !== 'revenda')) {
            return res.status(403).json({
                success: false,
                message: 'Acesso não autorizado'
            });
        }

        const result = await StreamingControlService.removerStreaming(login, userType);

        if (result.success) {
            return res.json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('Erro ao remover streaming:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao remover streaming',
            error: error.message
        });
    }
});

/**
 * GET /api/streaming-control/status/:login
 * Verificar status do streaming
 */
router.get('/status/:login', async (req, res) => {
    try {
        const { login } = req.params;

        if (!login) {
            return res.status(400).json({
                success: false,
                message: 'Login do streaming é obrigatório'
            });
        }

        // Buscar configurações globais (opcional)
        const db = require('../config/database');
        const [configRows] = await db.execute('SELECT * FROM configuracoes LIMIT 1');
        const configData = configRows.length > 0 ? configRows[0] : null;

        const result = await StreamingControlService.verificarStatus(login, configData);

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao verificar status',
            error: error.message
        });
    }
});

/**
 * GET /api/streaming/status
 * Verificar status de transmissão ativa
 */
router.get('/status', async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.codigo;
        const db = require('../config/database');

        // Verificar se há transmissão ativa
        const [transmissions] = await db.execute(
            `SELECT t.*, p.nome as playlist_nome, p.id as codigo_playlist
             FROM transmissoes t
             LEFT JOIN playlists p ON t.codigo_playlist = p.id
             WHERE t.codigo_stm = ? AND t.status = 'ativa'
             ORDER BY t.data_inicio DESC
             LIMIT 1`,
            [userId]
        );

        if (transmissions.length === 0) {
            return res.json({
                is_live: false,
                stream_type: null,
                transmission: null
            });
        }

        const transmission = transmissions[0];

        return res.json({
            is_live: true,
            stream_type: transmission.codigo_playlist ? 'playlist' : 'obs',
            transmission: {
                id: transmission.codigo,
                titulo: transmission.titulo,
                codigo_playlist: transmission.codigo_playlist,
                stats: {
                    viewers: 0,
                    bitrate: 0,
                    uptime: '00:00:00',
                    isActive: true
                },
                platforms: []
            }
        });

    } catch (error) {
        console.error('Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao verificar status',
            error: error.message
        });
    }
});

/**
 * POST /api/streaming/start
 * Iniciar transmissão de playlist
 */
router.post('/start', async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.codigo;
        const { titulo, descricao, playlist_id, platform_ids, enable_recording, use_smil, loop_playlist } = req.body;
        const db = require('../config/database');

        if (!playlist_id) {
            return res.status(400).json({
                success: false,
                error: 'ID da playlist é obrigatório'
            });
        }

        console.log(`🎬 Iniciando transmissão de playlist ${playlist_id} para usuário ${userId}`);

        // Verificar se playlist existe e pertence ao usuário
        const [playlists] = await db.execute(
            'SELECT id, nome FROM playlists WHERE id = ? AND codigo_stm = ?',
            [playlist_id, userId]
        );

        if (playlists.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Playlist não encontrada'
            });
        }

        const playlist = playlists[0];

        // Buscar vídeos da playlist para validar usando a tabela playlist_videos
        const [videos] = await db.execute(
            `SELECT COUNT(*) as total FROM playlist_videos pv
             INNER JOIN videos v ON pv.video_id = v.id
             WHERE pv.playlist_id = ? AND v.codigo_cliente = ?`,
            [playlist_id, userId]
        );

        if (videos[0].total === 0) {
            return res.status(400).json({
                success: false,
                error: 'A playlist não possui vídeos. Adicione vídeos antes de iniciar a transmissão.'
            });
        }

        console.log(`📹 Playlist "${playlist.nome}" possui ${videos[0].total} vídeos`);

        // Buscar dados do servidor do usuário
        const userLogin = req.user.usuario || `user_${userId}`;
        const [streamingRows] = await db.execute(
            'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
            [userId]
        );
        const serverId = streamingRows.length > 0 ? streamingRows[0].codigo_servidor : 1;

        // Buscar dados do servidor
        const [serverRows] = await db.execute(
            'SELECT ip, dominio FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
            [serverId]
        );

        if (serverRows.length === 0) {
            return res.status(500).json({
                success: false,
                error: 'Servidor não encontrado ou inativo'
            });
        }

        const servidor = serverRows[0].dominio || serverRows[0].ip;

        // Verificar se há transmissão ativa
        const [activeTransmissions] = await db.execute(
            'SELECT codigo FROM transmissoes WHERE codigo_stm = ? AND status = "ativa"',
            [userId]
        );

        if (activeTransmissions.length > 0) {
            // Finalizar transmissão ativa anterior
            await db.execute(
                'UPDATE transmissoes SET status = "finalizada", data_fim = NOW() WHERE codigo = ?',
                [activeTransmissions[0].codigo]
            );
            console.log(`⏹️ Transmissão anterior finalizada: ${activeTransmissions[0].codigo}`);
        }

        // Criar nova transmissão
        const [result] = await db.execute(
            `INSERT INTO transmissoes
             (codigo_stm, titulo, descricao, codigo_playlist, status, data_inicio, tipo_transmissao)
             VALUES (?, ?, ?, ?, 'ativa', NOW(), 'playlist')`,
            [userId, titulo, descricao || '', playlist_id]
        );

        const transmissionId = result.insertId;
        console.log(`✅ Transmissão criada com ID: ${transmissionId}`);

        // Gerar arquivo SMIL específico para esta playlist
        try {
            const PlaylistSMILService = require('../services/PlaylistSMILService');
            const smilResult = await PlaylistSMILService.generatePlaylistSMIL(
                userId,
                userLogin,
                serverId,
                playlist_id
            );

            if (smilResult.success) {
                console.log(`✅ Arquivo SMIL gerado com sucesso:`);
                console.log(`   📄 Caminho: ${smilResult.smil_path}`);
                console.log(`   📹 Vídeos: ${smilResult.videos_count}`);
                console.log(`   🔗 URL HLS: ${smilResult.playlist_url_http}`);

                // Iniciar a aplicação Wowza via JMX (método que funciona)
                try {
                    const SSHManager = require('../config/SSHManager');
                    const jmxCommand = '/usr/bin/java -cp /usr/local/WowzaMediaServer JMXCommandLine -jmx service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi -user admin -pass admin';

                    // Verificar se aplicação está rodando
                    const checkCommand = `${jmxCommand} getApplicationInstanceInfo ${userLogin}`;
                    const checkResult = await SSHManager.executeCommand(serverId, checkCommand);

                    const isRunning = checkResult.stdout && checkResult.stdout.includes('loaded');

                    if (!isRunning) {
                        console.log(`🚀 Iniciando aplicação Wowza para ${userLogin}...`);
                        const startCommand = `${jmxCommand} startAppInstance ${userLogin}`;
                        const startResult = await SSHManager.executeCommand(serverId, startCommand);

                        if (startResult.stdout && !startResult.stdout.includes('ERROR')) {
                            console.log(`✅ Aplicação Wowza iniciada com sucesso para ${userLogin}`);
                        } else {
                            console.warn(`⚠️ Aviso ao iniciar aplicação Wowza:`, startResult.stdout || startResult.stderr);
                        }
                    } else {
                        console.log(`✅ Aplicação Wowza já está rodando para ${userLogin}`);
                    }

                } catch (wowzaError) {
                    console.warn(`⚠️ Erro ao iniciar aplicação Wowza: ${wowzaError.message}`);
                }
            } else {
                console.warn('⚠️ Erro ao gerar SMIL:', smilResult.error);
                return res.status(500).json({
                    success: false,
                    error: 'Erro ao gerar arquivo SMIL da playlist',
                    details: smilResult.error
                });
            }
        } catch (smilError) {
            console.error('❌ Erro ao gerar arquivo SMIL:', smilError);
            return res.status(500).json({
                success: false,
                error: 'Erro ao preparar playlist para transmissão',
                details: smilError.message
            });
        }

        // Construir URLs do player
        const baseUrl = process.env.NODE_ENV === 'production'
            ? 'https://samhost.wcore.com.br:3001'
            : 'http://localhost:3001';

        const playerUrls = {
            iframe: `${baseUrl}/api/player-port/iframe?login=${userLogin}&playlist=${playlist_id}&player=1&contador=true&compartilhamento=true`,
            direct_hls: `https://${servidor}/${userLogin}/smil:playlists_agendamentos.smil/playlist.m3u8`,
            direct_rtmp: `rtmp://${servidor}:1935/${userLogin}/smil:playlists_agendamentos.smil`,
            wowza_url: `https://${servidor}/${userLogin}/${userLogin}/playlist.m3u8`
        };

        console.log(`🎥 Player URLs geradas para ${userLogin}`);
        console.log(`🔗 URL principal: ${playerUrls.direct_hls}`);

        return res.json({
            success: true,
            transmission_id: transmissionId,
            message: `Transmissão da playlist "${playlist.nome}" iniciada com sucesso`,
            playlist_name: playlist.nome,
            videos_count: videos[0].total,
            player_urls: playerUrls,
            streaming_info: {
                server: servidor,
                user_login: userLogin,
                smil_file: 'playlists_agendamentos.smil',
                status: 'Transmitindo'
            },
            instructions: {
                access: `Acesse a transmissão em: ${playerUrls.direct_hls}`,
                player: 'Use a URL do iframe para incorporar o player em seu site',
                obs: 'A transmissão está ativa e pode ser acessada pelos links acima'
            }
        });

    } catch (error) {
        console.error('❌ Erro ao iniciar transmissão:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao iniciar transmissão',
            details: error.message
        });
    }
});

/**
 * POST /api/streaming/stop
 * Finalizar transmissão
 */
router.post('/stop', async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.codigo;
        const { transmission_id, stream_type } = req.body;
        const db = require('../config/database');

        if (!transmission_id) {
            return res.status(400).json({
                success: false,
                error: 'ID da transmissão é obrigatório'
            });
        }

        console.log(`🛑 Finalizando transmissão ${transmission_id} para usuário ${userId}`);

        // Buscar dados da transmissão
        const [transmissions] = await db.execute(
            'SELECT * FROM transmissoes WHERE codigo = ? AND codigo_stm = ?',
            [transmission_id, userId]
        );

        if (transmissions.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transmissão não encontrada'
            });
        }

        const transmission = transmissions[0];

        // Se for transmissão de playlist, parar aplicação Wowza
        if (transmission.codigo_playlist) {
            try {
                const userLogin = req.user?.usuario || `user_${userId}`;

                // Buscar servidor do usuário
                const [streamingRows] = await db.execute(
                    'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
                    [userId]
                );
                const serverId = streamingRows.length > 0 ? streamingRows[0].codigo_servidor : 1;

                // Parar aplicação Wowza via JMX (opcional - pode deixar rodando)
                // A transmissão para quando não há fonte ativa
                console.log(`ℹ️ Aplicação Wowza para ${userLogin} continua rodando (pronta para nova transmissão)`);

            } catch (wowzaError) {
                console.warn(`⚠️ Aviso ao parar aplicação Wowza: ${wowzaError.message}`);
            }
        }

        // Finalizar transmissão no banco
        await db.execute(
            'UPDATE transmissoes SET status = "finalizada", data_fim = NOW() WHERE codigo = ?',
            [transmission_id]
        );

        console.log(`✅ Transmissão ${transmission_id} finalizada com sucesso`);

        return res.json({
            success: true,
            message: 'Transmissão finalizada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao finalizar transmissão:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao finalizar transmissão',
            details: error.message
        });
    }
});

/**
 * GET /api/streaming-control/list
 * Listar streamings do usuário
 */
router.get('/list', async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.codigo;
        const db = require('../config/database');

        const [streamings] = await db.execute(
            `SELECT s.*, srv.nome as servidor_nome, srv.status as servidor_status
             FROM streamings s
             LEFT JOIN servidores srv ON s.codigo_servidor = srv.codigo
             WHERE s.codigo_cliente = ?
             ORDER BY s.login`,
            [userId]
        );

        return res.json({
            success: true,
            streamings
        });

    } catch (error) {
        console.error('Erro ao listar streamings:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao listar streamings',
            error: error.message
        });
    }
});

/**
 * GET /api/streaming/platforms
 * Listar plataformas de transmissão disponíveis
 */
router.get('/platforms', async (req, res) => {
    try {
        const db = require('../config/database');

        const [platforms] = await db.execute(
            `SELECT id, nome, rtmp_base_url, requer_stream_key,
             supports_https, special_config
             FROM streaming_platforms
             WHERE ativo = 1
             ORDER BY nome`
        );

        // Se não houver plataformas no banco, retornar plataformas padrão
        if (platforms.length === 0) {
            const defaultPlatforms = [
                {
                    id: 'youtube',
                    nome: 'YouTube Live',
                    rtmp_base_url: 'rtmp://a.rtmp.youtube.com/live2/',
                    requer_stream_key: true,
                    supports_https: true
                },
                {
                    id: 'facebook',
                    nome: 'Facebook Live',
                    rtmp_base_url: 'rtmps://live-api-s.facebook.com:443/rtmp/',
                    requer_stream_key: true,
                    supports_https: true
                },
                {
                    id: 'twitch',
                    nome: 'Twitch',
                    rtmp_base_url: 'rtmp://live.twitch.tv/app/',
                    requer_stream_key: true,
                    supports_https: false
                },
                {
                    id: 'custom',
                    nome: 'Servidor Personalizado',
                    rtmp_base_url: '',
                    requer_stream_key: true,
                    supports_https: false
                }
            ];
            return res.json({ success: true, platforms: defaultPlatforms });
        }

        return res.json({ success: true, platforms });

    } catch (error) {
        console.error('Erro ao listar plataformas:', error);
        // Retornar plataformas padrão em caso de erro
        const defaultPlatforms = [
            {
                id: 'youtube',
                nome: 'YouTube Live',
                rtmp_base_url: 'rtmp://a.rtmp.youtube.com/live2/',
                requer_stream_key: true,
                supports_https: true
            },
            {
                id: 'facebook',
                nome: 'Facebook Live',
                rtmp_base_url: 'rtmps://live-api-s.facebook.com:443/rtmp/',
                requer_stream_key: true,
                supports_https: true
            },
            {
                id: 'twitch',
                nome: 'Twitch',
                rtmp_base_url: 'rtmp://live.twitch.tv/app/',
                requer_stream_key: true,
                supports_https: false
            },
            {
                id: 'custom',
                nome: 'Servidor Personalizado',
                rtmp_base_url: '',
                requer_stream_key: true,
                supports_https: false
            }
        ];
        res.json({ success: true, platforms: defaultPlatforms });
    }
});

/**
 * GET /api/streaming/lives
 * Listar transmissões ao vivo do usuário
 */
router.get('/lives', async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.codigo;
        const db = require('../config/database');

        const [lives] = await db.execute(
            `SELECT l.*,
             DATE_FORMAT(l.data_inicio, '%d/%m/%Y %H:%i') as data_inicio_formatted,
             DATE_FORMAT(l.data_fim, '%d/%m/%Y %H:%i') as data_fim_formatted,
             CASE
                WHEN l.status = '1' THEN 'Ativa'
                WHEN l.status = '2' THEN 'Agendada'
                WHEN l.status = '0' THEN 'Encerrada'
                ELSE 'Desconhecida'
             END as status_text,
             TIMEDIFF(l.data_fim, l.data_inicio) as duracao
             FROM lives l
             WHERE l.codigo_stm = ?
             ORDER BY l.data_inicio DESC
             LIMIT 50`,
            [userId]
        );

        return res.json({ success: true, lives });

    } catch (error) {
        console.error('Erro ao listar lives:', error);
        // Retornar array vazio em vez de erro
        res.json({ success: true, lives: [] });
    }
});

/**
 * GET /api/streaming/obs-status
 * Verificar status de transmissão OBS via Wowza
 */
router.get('/obs-status', async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.codigo;
        const db = require('../config/database');

        // Buscar dados do servidor Wowza do usuário
        const [streamingRows] = await db.execute(
            'SELECT codigo_servidor, usuario FROM streamings WHERE codigo_cliente = ? LIMIT 1',
            [userId]
        );

        if (streamingRows.length === 0) {
            return res.json({
                success: true,
                is_live: false,
                message: 'Usuário não possui streaming configurado'
            });
        }

        const serverId = streamingRows[0].codigo_servidor;
        const userLogin = streamingRows[0].usuario;

        // Buscar configurações do servidor Wowza
        const [serverRows] = await db.execute(
            'SELECT ip, dominio, porta_api, usuario_api, senha_api FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
            [serverId]
        );

        if (serverRows.length === 0) {
            return res.json({
                success: true,
                is_live: false,
                message: 'Servidor Wowza não encontrado'
            });
        }

        const server = serverRows[0];
        const wowzaHost = server.dominio || server.ip;
        const wowzaPort = server.porta_api || 8087;
        // Usar credenciais do banco ou valores padrão
        const wowzaUser = server.usuario_api || 'admin';
        const wowzaPassword = server.senha_api || 'admin';

        // Verificar streams ativos na aplicação do usuário
        const fetch = require('node-fetch');
        const apiUrl = `http://${wowzaHost}:${wowzaPort}/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/${userLogin}/instances/_definst_/incomingstreams`;

        const auth = Buffer.from(`${wowzaUser}:${wowzaPassword}`).toString('base64');
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        if (!response.ok) {
            return res.json({
                success: true,
                is_live: false,
                message: 'Não foi possível verificar status'
            });
        }

        const data = await response.json();
        const streams = data.incomingstreams || [];
        const activeStream = streams.find(s => s.isConnected === true);

        if (activeStream) {
            return res.json({
                success: true,
                is_live: true,
                stream_name: activeStream.name,
                uptime: activeStream.uptimeMilliseconds || 0,
                bitrate: activeStream.totalIncomingBitrate || 0,
                viewers: activeStream.messagesOutBytesRate || 0
            });
        }

        return res.json({
            success: true,
            is_live: false
        });

    } catch (error) {
        console.error('Erro ao verificar status OBS:', error);
        res.json({
            success: true,
            is_live: false,
            message: 'Erro ao verificar status'
        });
    }
});

/**
 * POST /api/streaming-control/recarregar-playlists
 * Recarregar playlists/agendamentos sem reiniciar streaming
 */
router.post('/recarregar-playlists', async (req, res) => {
    try {
        const { login } = req.body;

        if (!login) {
            return res.status(400).json({
                success: false,
                message: 'Login do streaming é obrigatório'
            });
        }

        console.log(`🔄 Recarregando playlists para: ${login}`);

        const result = await StreamingControlService.recarregarPlaylistsAgendamentos(login);

        if (result.success) {
            return res.json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('Erro ao recarregar playlists:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao recarregar playlists',
            error: error.message
        });
    }
});

/**
 * GET /api/streaming/source-urls
 * Obter URLs de origem para transmissão
 */
router.get('/source-urls', async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.codigo;
        const userLogin = req.user?.usuario || `user_${userId}`;
        const db = require('../config/database');

        // Buscar dados do servidor Wowza do usuário
        const [streamingRows] = await db.execute(
            'SELECT codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
            [userId]
        );

        let wowzaHost = 'stmv1.udicast.com';
        let rtmpPort = 1935;

        if (streamingRows.length > 0) {
            const serverId = streamingRows[0].codigo_servidor;
            const [serverRows] = await db.execute(
                'SELECT ip, dominio, porta_api FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
                [serverId]
            );

            if (serverRows.length > 0) {
                const server = serverRows[0];
                wowzaHost = server.dominio || server.ip || 'stmv1.udicast.com';
            }
        }

        const urls = {
            http_m3u8: `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`,
            https_m3u8: `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`,
            rtmp: `rtmp://${wowzaHost}:${rtmpPort}/${userLogin}/${userLogin}`,
            rtmps: `rtmps://${wowzaHost}:443/${userLogin}/${userLogin}`,
            recommended: 'https_m3u8'
        };

        return res.json({
            success: true,
            urls,
            user_login: userLogin,
            server: wowzaHost
        });

    } catch (error) {
        console.error('Erro ao obter URLs de origem:', error);
        const userId = req.user?.id || req.user?.codigo;
        const userLogin = req.user?.usuario || `user_${userId}`;
        const wowzaHost = 'stmv1.udicast.com';

        // Retornar URLs padrão em caso de erro
        res.json({
            success: true,
            urls: {
                http_m3u8: `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`,
                https_m3u8: `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`,
                rtmp: `rtmp://${wowzaHost}:1935/${userLogin}/${userLogin}`,
                rtmps: `rtmps://${wowzaHost}:443/${userLogin}/${userLogin}`,
                recommended: 'https_m3u8'
            },
            user_login: userLogin,
            server: wowzaHost
        });
    }
});

module.exports = router;