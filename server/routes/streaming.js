import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';
import { WowzaStreamingService } from '../services/WowzaStreamingService.js';

const router = express.Router();

// GET /api/streaming/platforms - Listar plataformas disponíveis
router.get('/platforms', supabaseAuthMiddleware, async (req, res) => {
    try {
        const { data: platforms, error } = await supabase
            .from('streaming_platforms')
            .select('*')
            .eq('ativo', true)
            .order('nome');

        if (error) throw error;

        res.json({ success: true, platforms });
    } catch (error) {
        console.error('Erro ao buscar plataformas:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar plataformas de streaming' 
        });
    }
});

// GET /api/streaming/user-platforms - Listar plataformas configuradas pelo usuário
router.get('/user-platforms', supabaseAuthMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: userPlatforms, error } = await supabase
            .from('user_streaming_platforms')
            .select(`
                *,
                platform:streaming_platforms(*)
            `)
            .eq('id_user', userId)
            .eq('ativo', true);

        if (error) throw error;

        res.json({ success: true, platforms: userPlatforms });
    } catch (error) {
        console.error('Erro ao buscar plataformas do usuário:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar suas plataformas configuradas' 
        });
    }
});

// POST /api/streaming/configure-platform - Configurar plataforma do usuário
router.post('/configure-platform', supabaseAuthMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            platform_id, 
            stream_key, 
            rtmp_url, 
            titulo_padrao, 
            descricao_padrao 
        } = req.body;

        if (!platform_id || !stream_key) {
            return res.status(400).json({ 
                success: false, 
                error: 'Platform ID e Stream Key são obrigatórios' 
            });
        }

        // Verificar se a plataforma existe
        const { data: platform, error: platformError } = await supabase
            .from('streaming_platforms')
            .select('*')
            .eq('id', platform_id)
            .single();

        if (platformError || !platform) {
            return res.status(404).json({ 
                success: false, 
                error: 'Plataforma não encontrada' 
            });
        }

        // Inserir ou atualizar configuração
        const { data, error } = await supabase
            .from('user_streaming_platforms')
            .upsert({
                id_user: userId,
                id_platform: platform_id,
                stream_key,
                rtmp_url: rtmp_url || platform.rtmp_base_url,
                titulo_padrao,
                descricao_padrao,
                ativo: true,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, platform: data });
    } catch (error) {
        console.error('Erro ao configurar plataforma:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao configurar plataforma' 
        });
    }
});

// DELETE /api/streaming/user-platforms/:id - Remover plataforma configurada
router.delete('/user-platforms/:id', supabaseAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verificar se existe transmissão ativa usando esta plataforma
        const { data: activeTransmissions } = await supabase
            .from('transmission_platforms')
            .select(`
                id,
                transmissions!inner(status)
            `)
            .eq('id_user_platform', id)
            .in('transmissions.status', ['ativa', 'preparando']);

        if (activeTransmissions && activeTransmissions.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Não é possível remover plataforma com transmissões ativas'
            });
        }

        const { error } = await supabase
            .from('user_streaming_platforms')
            .delete()
            .eq('id', id)
            .eq('id_user', userId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao remover plataforma:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao remover plataforma' 
        });
    }
});

// POST /api/streaming/start - Iniciar transmissão
router.post('/start', supabaseAuthMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            titulo, 
            descricao, 
            playlist_id, 
            platform_ids = [], 
            server_id,
            id_transmission_settings,
            settings = {}
        } = req.body;

        console.log('[STREAMING] Iniciando transmissão:', {
            userId,
            titulo,
            playlist_id,
            platform_ids,
            settings
        });

        if (!titulo || platform_ids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Título e pelo menos uma plataforma são obrigatórios' 
            });
        }

        // Verificar se há transmissão ativa
        const { data: activeTransmission } = await supabase
            .from('transmissions')
            .select('id')
            .eq('id_user', userId)
            .eq('status', 'ativa')
            .single();

        if (activeTransmission) {
            return res.status(400).json({ 
                success: false, 
                error: 'Você já possui uma transmissão ativa' 
            });
        }

        // Buscar plataformas configuradas pelo usuário
        const { data: userPlatforms, error: platformsError } = await supabase
            .from('user_streaming_platforms')
            .select(`
                *,
                platform:streaming_platforms(*)
            `)
            .eq('id_user', userId)
            .in('id', platform_ids)
            .eq('ativo', true);

        if (platformsError || !userPlatforms || userPlatforms.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nenhuma plataforma válida encontrada' 
            });
        }

        console.log('[STREAMING] Plataformas encontradas:', userPlatforms.length);

        // Buscar vídeos da playlist se especificada
        let playlistVideos = [];
        if (playlist_id) {
            const { data: videos } = await supabase
                .from('playlist_videos')
                .select(`
                    ordem,
                    videos(*)
                `)
                .eq('id_playlist', playlist_id)
                .order('ordem');

            playlistVideos = videos?.map(v => v.videos) || [];
            console.log('[STREAMING] Vídeos da playlist:', playlistVideos.length);
        }

        // Inicializar serviço Wowza
        const wowzaService = new WowzaStreamingService();
        
        // Gerar nome único para o stream
        const streamName = `user_${userId}_${Date.now()}`;
        
        // Criar transmissão no banco
        const { data: transmission, error: transmissionError } = await supabase
            .from('transmissions')
            .insert({
                id_user: userId,
                id_server: server_id,
                id_playlist: playlist_id,
                titulo,
                descricao,
                status: 'preparando',
                tipo: playlist_id ? 'playlist' : 'manual',
                wowza_application_name: 'live',
                wowza_stream_name: streamName,
                id_transmission_settings,
                configuracoes: {
                    platforms: platform_ids,
                    auto_start: true
                },
                playlist_config: settings
            })
            .select()
            .single();

        if (transmissionError) throw transmissionError;

        console.log('[STREAMING] Transmissão criada no banco:', transmission.id);

        // Iniciar stream no Wowza
        const wowzaResult = await wowzaService.startStream({
            streamId: transmission.id,
            userId,
            playlistId: playlist_id,
            videos: playlistVideos,
            platforms: userPlatforms,
            settings
        });

        console.log('[STREAMING] Resultado do Wowza:', wowzaResult);

        if (!wowzaResult.success) {
            // Marcar transmissão como erro
            await supabase
                .from('transmissions')
                .update({ 
                    status: 'erro', 
                    erro_detalhes: wowzaResult.error 
                })
                .eq('id', transmission.id);

            return res.status(500).json({ 
                success: false, 
                error: wowzaResult.error || 'Erro ao iniciar stream no Wowza' 
            });
        }

        // Criar stream no banco
        const { data: stream, error: streamError } = await supabase
            .from('streams')
            .insert({
                user_id: userId,
                server_id: server_id,
                transmission_id: transmission.id,
                is_live: true,
                viewers: 0,
                bitrate: wowzaResult.bitrate || 0,
                uptime: '00:00:00',
                wowza_stream_name: streamName,
                wowza_application: 'live',
                quality_settings: {
                    resolution: '1920x1080',
                    fps: 30,
                    bitrate: wowzaResult.bitrate || 2500
                }
            })
            .select()
            .single();

        if (streamError) throw streamError;

        console.log('[STREAMING] Stream criado no banco:', stream.id);

        // Configurar plataformas na transmissão
        const platformInserts = userPlatforms.map(up => ({
            id_transmission: transmission.id,
            id_user_platform: up.id,
            status: 'ativa',
            wowza_publisher_name: `${streamName}_${up.platform.codigo}`
        }));

        const { error: platformsInsertError } = await supabase
            .from('transmission_platforms')
            .insert(platformInserts);

        if (platformsInsertError) {
            console.error('[STREAMING] Erro ao inserir plataformas:', platformsInsertError);
        }

        // Atualizar status da transmissão
        await supabase
            .from('transmissions')
            .update({ 
                status: 'ativa',
                data_inicio: new Date().toISOString()
            })
            .eq('id', transmission.id);

        console.log('[STREAMING] Transmissão iniciada com sucesso');

        res.json({ 
            success: true, 
            transmission: {
                ...transmission,
                status: 'ativa',
                data_inicio: new Date().toISOString()
            },
            stream,
            wowza_data: wowzaResult.data,
            platforms: userPlatforms.length
        });

    } catch (error) {
        console.error('[STREAMING] Erro ao iniciar transmissão:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno ao iniciar transmissão' 
        });
    }
});

// POST /api/streaming/stop - Parar transmissão
router.post('/stop', supabaseAuthMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { transmission_id } = req.body;

        console.log('[STREAMING] Parando transmissão:', { userId, transmission_id });

        // Buscar transmissão ativa
        let query = supabase
            .from('transmissions')
            .select('*')
            .eq('id_user', userId)
            .eq('status', 'ativa');

        if (transmission_id) {
            query = query.eq('id', transmission_id);
        }

        const { data: transmission, error: transmissionError } = await query.single();

        if (transmissionError || !transmission) {
            return res.status(404).json({ 
                success: false, 
                error: 'Transmissão ativa não encontrada' 
            });
        }

        console.log('[STREAMING] Transmissão encontrada:', transmission.id);

        // Parar stream no Wowza
        const wowzaService = new WowzaStreamingService();
        const wowzaResult = await wowzaService.stopStream(transmission.id);

        console.log('[STREAMING] Resultado do stop no Wowza:', wowzaResult);

        // Atualizar transmissão no banco
        await supabase
            .from('transmissions')
            .update({ 
                status: 'finalizada',
                data_fim: new Date().toISOString()
            })
            .eq('id', transmission.id);

        // Atualizar stream
        await supabase
            .from('streams')
            .update({ 
                is_live: false,
                updated_at: new Date().toISOString()
            })
            .eq('transmission_id', transmission.id);

        // Atualizar status das plataformas
        await supabase
            .from('transmission_platforms')
            .update({ status: 'finalizada' })
            .eq('id_transmission', transmission.id);

        console.log('[STREAMING] Transmissão finalizada com sucesso');

        res.json({ 
            success: true, 
            message: 'Transmissão finalizada com sucesso',
            wowza_result: wowzaResult
        });

    } catch (error) {
        console.error('[STREAMING] Erro ao parar transmissão:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno ao parar transmissão' 
        });
    }
});

// GET /api/streaming/status - Status da transmissão atual
router.get('/status', supabaseAuthMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Buscar transmissão ativa
        const { data: transmission, error: transmissionError } = await supabase
            .from('transmissions')
            .select(`
                *,
                stream:streams(*),
                platforms:transmission_platforms(
                    *,
                    user_platform:user_streaming_platforms(
                        *,
                        platform:streaming_platforms(*)
                    )
                )
            `)
            .eq('id_user', userId)
            .eq('status', 'ativa')
            .single();

        if (transmissionError || !transmission) {
            return res.json({ 
                success: true, 
                is_live: false, 
                transmission: null 
            });
        }

        // Buscar estatísticas do Wowza
        const wowzaService = new WowzaStreamingService();
        const stats = await wowzaService.getStreamStats(transmission.id);

        // Atualizar estatísticas no banco se o stream estiver ativo
        if (stats.isActive && transmission.stream) {
            await supabase
                .from('streams')
                .update({
                    viewers: stats.viewers,
                    bitrate: stats.bitrate,
                    uptime: stats.uptime,
                    last_stats_update: new Date().toISOString()
                })
                .eq('id', transmission.stream.id);
        }

        res.json({ 
            success: true, 
            is_live: true,
            transmission: {
                ...transmission,
                stats
            }
        });

    } catch (error) {
        console.error('[STREAMING] Erro ao buscar status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar status da transmissão' 
        });
    }
});

// GET /api/streaming/history - Histórico de transmissões
router.get('/history', supabaseAuthMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        const offset = (page - 1) * limit;

        const { data: transmissions, error } = await supabase
            .from('transmissions')
            .select(`
                *,
                playlist:playlists(nome),
                platforms:transmission_platforms(
                    user_platform:user_streaming_platforms(
                        platform:streaming_platforms(nome, codigo)
                    )
                )
            `)
            .eq('id_user', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({ success: true, transmissions });
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar histórico de transmissões' 
        });
    }
});

export default router;