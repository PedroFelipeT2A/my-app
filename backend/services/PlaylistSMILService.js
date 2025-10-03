const SSHManager = require('../config/SSHManager');
const WowzaConfigManager = require('../config/WowzaConfigManager');
const db = require('../config/database');

class PlaylistSMILService {
    constructor() {
        // Template baseado no formato do exemplo fornecido
        this.smilTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<smil title="{{USER_LOGIN}}">
<head></head>
<body>
<stream name="{{USER_LOGIN}}"></stream>

{{PLAYLISTS_CONTENT}}
</body>
</smil>`;
    }

    // Gerar arquivo SMIL para um usuário específico
    async generateUserSMIL(userId, userLogin, serverId) {
        try {
            console.log(`📄 Gerando arquivo SMIL para usuário: ${userLogin}`);
            
            const db = require('../config/database');

            // Garantir que diretório do usuário existe
            const userPath = `/home/streaming/${userLogin}`;
            const pathExists = await SSHManager.checkDirectoryExists(serverId, userPath);
            
            if (!pathExists) {
                console.log(`📁 Criando diretório do usuário: ${userPath}`);
                const createResult = await SSHManager.createUserDirectory(serverId, userLogin);
                if (!createResult.success) {
                    console.warn('Aviso ao criar diretório do usuário:', createResult.error);
                }
            }

            // Buscar playlists e agendamentos do usuário
            const [playlistRows] = await db.execute(
                'SELECT id, nome FROM playlists WHERE codigo_stm = ? ORDER BY id',
                [userId]
            );

            // Buscar agendamentos ativos do usuário
            const [agendamentoRows] = await db.execute(
                `SELECT 
                    pa.codigo_playlist,
                    pa.data,
                    pa.hora,
                    pa.minuto,
                    pa.shuffle,
                    pa.frequencia,
                    p.nome as playlist_nome
                 FROM playlists_agendamentos pa
                 JOIN playlists p ON pa.codigo_playlist = p.id
                 WHERE pa.codigo_stm = ? AND pa.data >= CURDATE()
                 ORDER BY pa.data, pa.hora, pa.minuto`,
                [userId]
            );
            if (playlistRows.length === 0) {
                // Criar arquivo SMIL vazio mesmo sem playlists
                const emptySmilContent = this.generateEmptySMIL(userLogin);
                const smilPath = `/home/streaming/${userLogin}/playlists_agendamentos.smil`;
                
                try {
                    await this.saveSMILToServer(serverId, userLogin, emptySmilContent, smilPath);
                } catch (smilError) {
                    console.warn('Aviso SMIL:', smilError.message);
                    // Continuar sem falhar
                }
                
                return { 
                    success: true, 
                    smil_path: smilPath,
                    playlists_count: 0,
                    total_videos: 0,
                    message: 'Arquivo SMIL vazio criado'
                };
            }

            // Gerar conteúdo SMIL baseado no formato do exemplo
            let smilContent = this.generateSMILFromTemplate(userLogin, playlistRows, agendamentoRows, userId);

            // Salvar arquivo no servidor
            const smilPath = `/home/streaming/${userLogin}/playlists_agendamentos.smil`;
            
            try {
                const saveResult = await this.saveSMILToServer(serverId, userLogin, smilContent, smilPath);
                if (!saveResult.success) {
                    console.warn('Aviso ao salvar SMIL:', saveResult.error);
                }
            } catch (smilError) {
                console.warn('Aviso SMIL:', smilError.message);
                // Continuar sem falhar
            }

            return { 
                success: true, 
                smil_path: smilPath,
                playlists_count: playlistRows.length,
                agendamentos_count: agendamentoRows.length,
                total_videos: (typeof smilContent === 'string' ? smilContent.split('<video').length - 1 : 0)
            };

        } catch (error) {
            console.error(`Erro ao gerar SMIL para usuário ${userLogin}:`, error);
            // Retornar sucesso mesmo com erro para não bloquear outras operações
            return { 
                success: true, 
                smil_path: `/home/streaming/${userLogin}/playlists_agendamentos.smil`,
                playlists_count: 0,
                total_videos: 0,
                warning: error.message 
            };
        }
    }

    // Gerar SMIL baseado no formato do exemplo fornecido
    generateSMILFromTemplate(userLogin, playlists, agendamentos, userId) {
        try {
            const db = require('../config/database');
            
            let smilContent = `<?xml version="1.0" encoding="UTF-8"?>
<smil title="${userLogin}">
<head></head>
<body>
<stream name="${userLogin}"></stream>

`;

            // Processar agendamentos para gerar playlists no formato correto
            for (const agendamento of agendamentos) {
                const playlistName = agendamento.playlist_nome.toLowerCase().replace(/[^a-z0-9]/g, '');
                const scheduledDateTime = `${agendamento.data} ${agendamento.hora.toString().padStart(2, '0')}:${agendamento.minuto.toString().padStart(2, '0')}:00`;
                const repeat = agendamento.shuffle === 'sim' ? 'true' : 'true'; // Sempre true por padrão
                
                smilContent += `<playlist name="${playlistName}" playOnStream="${userLogin}" repeat="${repeat}" scheduled="${scheduledDateTime}">\n`;
                
                // Adicionar vídeo de exemplo para agendamento
                smilContent += `<video length="-1" src="mp4:default/sample.mp4" start="0"></video>\n`;
                
                smilContent += `</playlist>\n\n`;
            }

            smilContent += `</body>
</smil>`;

            return smilContent;
        } catch (error) {
            console.error('Erro ao gerar SMIL do template:', error);
            return this.generateEmptySMIL(userLogin);
        }
    }

    // Gerar SMIL vazio
    generateEmptySMIL(userLogin) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<smil title="${userLogin}">
<head></head>
<body>
<stream name="${userLogin}"></stream>

</body>
</smil>`;
    }

    // Gerar SMIL específico para agendamentos (formato do exemplo)
    async generateScheduledSMIL(userId, userLogin, serverId) {
        try {
            console.log(`📄 Gerando SMIL de agendamentos para usuário: ${userLogin}`);

            // Buscar agendamentos ativos do usuário
            const [agendamentoRows] = await db.execute(
                `SELECT 
                    pa.codigo_playlist,
                    pa.data,
                    pa.hora,
                    pa.minuto,
                    pa.shuffle,
                    pa.frequencia,
                    p.nome as playlist_nome
                 FROM playlists_agendamentos pa
                 JOIN playlists p ON pa.codigo_playlist = p.id
                 WHERE pa.codigo_stm = ? AND pa.data >= CURDATE()
                 ORDER BY pa.data, pa.hora, pa.minuto`,
                [userId]
            );

            let smilContent = `<?xml version="1.0" encoding="UTF-8"?>
<smil title="${userLogin}">
<head></head>
<body>
<stream name="${userLogin}"></stream>

`;

            // Processar cada agendamento
            for (const agendamento of agendamentoRows) {
                const playlistName = agendamento.playlist_nome.toLowerCase().replace(/[^a-z0-9]/g, '');
                const scheduledDateTime = `${agendamento.data} ${agendamento.hora.toString().padStart(2, '0')}:${agendamento.minuto.toString().padStart(2, '0')}:00`;
                const repeat = 'true'; // Sempre true conforme exemplo
                
                smilContent += `<playlist name="${playlistName}" playOnStream="${userLogin}" repeat="${repeat}" scheduled="${scheduledDateTime}">\n`;
                
                // Buscar vídeos da playlist
                const [videoRows] = await db.execute(
                    `SELECT v.nome, v.url, v.caminho, v.duracao 
                     FROM videos v 
                     WHERE v.playlist_id = ? AND v.codigo_cliente = ?
                     ORDER BY v.id`,
                    [agendamento.codigo_playlist, userId]
                );

                // Adicionar vídeos no formato do exemplo
                for (const video of videoRows) {
                    const videoPath = this.buildVideoPathForSMIL(video, userLogin);
                    const duration = video.duracao || -1;
                    
                    smilContent += `<video length="${duration}" src="mp4:${videoPath}" start="0"></video>\n`;
                }
                
                smilContent += `</playlist>\n\n`;
            }

            smilContent += `</body>
</smil>`;

            // Salvar arquivo no servidor
            const smilPath = `/home/streaming/${userLogin}/playlists_agendamentos.smil`;
            await this.saveSMILToServer(serverId, userLogin, smilContent, smilPath);

            console.log(`✅ Arquivo SMIL de agendamentos gerado: ${smilPath}`);

            // NOVO: Recarregar playlists no Wowza sem reiniciar streaming
            try {
                console.log(`🔄 Recarregando agendamentos no Wowza para ${userLogin}...`);
                const StreamingControlService = require('./StreamingControlService');
                const reloadResult = await StreamingControlService.recarregarPlaylistsAgendamentos(userLogin);

                if (reloadResult.success) {
                    console.log(`✅ Agendamentos recarregados com sucesso no Wowza`);
                } else {
                    console.warn(`⚠️ Aviso ao recarregar agendamentos:`, reloadResult.message);
                }
            } catch (reloadError) {
                console.warn(`⚠️ Erro ao recarregar agendamentos (continuando):`, reloadError.message);
            }

            return {
                success: true,
                smil_path: smilPath,
                agendamentos_count: agendamentoRows.length,
                total_videos: smilContent.split('<video').length - 1
            };

        } catch (error) {
            console.error(`Erro ao gerar SMIL de agendamentos para ${userLogin}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Construir caminho do vídeo para SMIL (formato: pasta/arquivo.mp4)
    buildVideoPathForSMIL(video, userLogin) {
        // Nova estrutura: pasta/arquivo.mp4 (sem o usuário no caminho)
        if (video.caminho && video.caminho.includes('/home/streaming/')) {
            // Extrair caminho relativo: /home/streaming/usuario/pasta/arquivo.mp4 -> pasta/arquivo.mp4
            const relativePath = video.caminho.replace(`/home/streaming/${userLogin}/`, '');
            return relativePath;
        } else if (video.url) {
            // Usar URL se disponível
            let cleanUrl = video.url;
            if (cleanUrl.startsWith('streaming/')) {
                cleanUrl = cleanUrl.replace('streaming/', '');
            }
            // Remover o usuário do início se presente: usuario/pasta/arquivo.mp4 -> pasta/arquivo.mp4
            const urlParts = cleanUrl.split('/');
            if (urlParts.length >= 3 && urlParts[0] === userLogin) {
                return urlParts.slice(1).join('/'); // Remove o primeiro elemento (usuário)
            }
            return cleanUrl;
        } else {
            // Fallback: construir caminho baseado no nome
            return `default/${video.nome}`;
        }
    }
    // Construir caminho do vídeo para o SMIL
    buildVideoPath(video, userLogin) {
        // Nova estrutura: usuario/pasta/arquivo.mp4
        if (video.caminho && video.caminho.includes('/home/streaming/')) {
            // Extrair caminho relativo da nova estrutura
            const relativePath = video.caminho.replace('/home/streaming/', '');
            return relativePath;
        } else if (video.url) {
            // Usar URL se disponível
            let cleanUrl = video.url;
            if (cleanUrl.startsWith('streaming/')) {
                cleanUrl = cleanUrl.replace('streaming/', '');
            }
            return cleanUrl;
        } else {
            // Fallback: construir caminho baseado no nome
            return `${userLogin}/default/${video.nome}`;
        }
    }

    // Salvar arquivo SMIL no servidor
    async saveSMILToServer(serverId, userLogin, smilContent, smilPath) {
        try {
            // Garantir que smilContent é uma string
            const contentString = typeof smilContent === 'string' ? smilContent : String(smilContent);
            
            console.log(`📄 Salvando arquivo SMIL: ${smilPath}`);
            
            const SSHManager = require('../config/SSHManager');

            // Garantir que o diretório do usuário existe
            const userDir = `/home/streaming/${userLogin}`;

            try {
                const dirExists = await SSHManager.checkDirectoryExists(serverId, userDir);

                if (!dirExists) {
                    console.log(`📁 Diretório do usuário não existe, criando: ${userDir}`);
                    const createDirResult = await SSHManager.createUserDirectory(serverId, userLogin);
                    if (!createDirResult.success) {
                        console.warn(`Aviso ao criar diretório: ${createDirResult.error}`);
                        // Continuar mesmo com erro
                    }

                    // Aguardar criação do diretório (reduzido)
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (sshError) {
                console.warn(`Aviso SSH ao verificar diretório: ${sshError.message}`);
                // Continuar mesmo com erro SSH
            }

            // Criar arquivo temporário local
            const tempFile = `/tmp/playlists_agendamentos_${userLogin}_${Date.now()}.smil`;
            const fs = require('fs').promises;
            await fs.writeFile(tempFile, contentString, 'utf8');

            try {
                // Enviar para servidor com retry automático
                await SSHManager.uploadFile(serverId, tempFile, smilPath, 2); // 2 tentativas
                console.log(`✅ Arquivo SMIL enviado: ${smilPath}`);

                // Definir permissões corretas (ignorar erros)
                try {
                    await SSHManager.executeCommand(serverId, `chmod 644 "${smilPath}" || true`, 1);
                    await SSHManager.executeCommand(serverId, `chown streaming:streaming "${smilPath}" || true`, 1);
                } catch (permError) {
                    console.warn('Aviso ao definir permissões SMIL:', permError.message);
                }
            } catch (uploadError) {
                console.error('Erro ao enviar SMIL:', uploadError);
                // Não lançar erro - apenas avisar e continuar
                console.warn('⚠️ Arquivo SMIL não foi enviado, mas transmissão pode continuar se arquivo já existir');
            }

            // Limpar arquivo temporário
            await fs.unlink(tempFile);

            return { success: true, path: smilPath };

        } catch (error) {
            console.error('Erro ao salvar SMIL no servidor:', error);
            // Não falhar se SMIL não puder ser criado - apenas avisar
            console.warn('⚠️ Continuando sem arquivo SMIL devido ao erro:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Gerar SMIL específico para uma playlist
    async generatePlaylistSMIL(userId, userLogin, serverId, playlistId) {
        try {
            console.log(`📄 Gerando arquivo SMIL para playlist ${playlistId} do usuário: ${userLogin}`);

            // Garantir que diretório do usuário existe
            const userPath = `/home/streaming/${userLogin}`;
            const pathExists = await SSHManager.checkDirectoryExists(serverId, userPath);
            
            if (!pathExists) {
                console.log(`📁 Criando diretório do usuário: ${userPath}`);
                const createResult = await SSHManager.createUserDirectory(serverId, userLogin);
                if (!createResult.success) {
                    console.warn('Aviso ao criar diretório do usuário:', createResult.error);
                }
            }

            // Buscar dados da playlist específica
            const [playlistRows] = await db.execute(
                'SELECT id, nome FROM playlists WHERE id = ? AND codigo_stm = ?',
                [playlistId, userId]
            );

            if (playlistRows.length === 0) {
                return { 
                    success: false, 
                    error: 'Playlist não encontrada' 
                };
            }

            const playlist = playlistRows[0];

            // Buscar vídeos da playlist usando a tabela de relação playlist_videos
            const [videoRows] = await db.execute(
                `SELECT v.nome, v.url, v.caminho, v.duracao
                 FROM playlist_videos pv
                 INNER JOIN videos v ON pv.video_id = v.id
                 WHERE pv.playlist_id = ? AND v.codigo_cliente = ?
                 ORDER BY pv.ordem ASC, v.id ASC`,
                [playlistId, userId]
            );

            if (videoRows.length === 0) {
                return { 
                    success: false, 
                    error: 'Playlist não possui vídeos' 
                };
            }

            // Gerar conteúdo SMIL específico para a playlist (formato correto para Wowza)
            let smilContent = `<?xml version="1.0" encoding="UTF-8"?>
<smil title="${userLogin}">
<head></head>
<body>
<stream name="${userLogin}"></stream>

`;

            const playlistName = playlist.nome.toLowerCase().replace(/[^a-z0-9]/g, '');
            smilContent += `<playlist name="${playlistName}" playOnStream="${userLogin}" repeat="true" scheduled="2024-01-01 00:00:00">\n`;
            
            // Adicionar vídeos da playlist
            for (const video of videoRows) {
                const videoPath = this.buildVideoPathForSMIL(video, userLogin);
                const duration = video.duracao || -1;
                
                smilContent += `<video length="${duration}" src="mp4:${videoPath}" start="0"></video>\n`;
            }
            
            smilContent += `</playlist>\n\n`;
            smilContent += `</body>\n</smil>`;

            // Salvar arquivo no servidor
            const smilPath = `/home/streaming/${userLogin}/playlists_agendamentos.smil`;

            try {
                const saveResult = await this.saveSMILToServer(serverId, userLogin, smilContent, smilPath);
                if (!saveResult.success) {
                    console.warn('Aviso ao salvar SMIL:', saveResult.error);
                }
                console.log(`✅ Arquivo SMIL salvo: ${smilPath}`);

                // Aguardar arquivo ser criado
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Verificar se arquivo foi criado
                const fileExists = await SSHManager.getFileInfo(serverId, smilPath);
                if (!fileExists.exists) {
                    console.warn(`⚠️ Arquivo SMIL não foi encontrado após criação: ${smilPath}`);
                }

                // NOVO: Recarregar playlists no Wowza sem reiniciar streaming
                try {
                    console.log(`🔄 Recarregando playlists no Wowza para ${userLogin}...`);
                    const StreamingControlService = require('./StreamingControlService');
                    const reloadResult = await StreamingControlService.recarregarPlaylistsAgendamentos(userLogin);

                    if (reloadResult.success) {
                        console.log(`✅ Playlists recarregadas com sucesso no Wowza`);
                    } else {
                        console.warn(`⚠️ Aviso ao recarregar playlists:`, reloadResult.message);
                    }
                } catch (reloadError) {
                    console.warn(`⚠️ Erro ao recarregar playlists (continuando):`, reloadError.message);
                }
            } catch (smilError) {
                console.warn('Aviso SMIL:', smilError.message);
                // Continuar sem falhar
            }

            return {
                success: true,
                smil_path: smilPath,
                playlist_name: playlist.nome,
                videos_count: videoRows.length,
                total_videos: smilContent ? smilContent.split('<video').length - 1 : 0,
                playlist_url_http: `https://stmv1.udicast.com/${userLogin}/smil:playlists_agendamentos.smil/playlist.m3u8`,
                playlist_rtmp_url: `rtmp://stmv1.udicast.com:1935/${userLogin}/smil:playlists_agendamentos.smil`,
                playlist_rtsp_url: `rtsp://stmv1.udicast.com:554/${userLogin}/smil:playlists_agendamentos.smil`,
                playlist_dash_url: `https://stmv1.udicast.com/${userLogin}/smil:playlists_agendamentos.smil/manifest.mpd`
            };

        } catch (error) {
            console.error(`Erro ao gerar SMIL para playlist ${playlistId}:`, error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // Atualizar SMIL quando playlist for modificada
    async updateUserSMIL(userId, userLogin, serverId) {
        try {
            console.log(`🔄 Atualizando SMIL para usuário: ${userLogin}`);
            return await this.generateUserSMIL(userId, userLogin, serverId);
        } catch (error) {
            console.error(`Erro ao atualizar SMIL para ${userLogin}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Remover arquivo SMIL do usuário
    async removeUserSMIL(serverId, userLogin) {
        try {
            const smilPath = `/home/streaming/${userLogin}/playlists_agendamentos.smil`;
            await SSHManager.deleteFile(serverId, smilPath);
            console.log(`🗑️ Arquivo SMIL removido: ${smilPath}`);
            return { success: true };
        } catch (error) {
            console.error(`Erro ao remover SMIL para ${userLogin}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Verificar se arquivo SMIL existe
    async checkSMILExists(serverId, userLogin) {
        try {
            const smilPath = `/home/streaming/${userLogin}/playlists_agendamentos.smil`;
            try {
                const fileInfo = await SSHManager.getFileInfo(serverId, smilPath);
                return fileInfo.exists;
            } catch (sshError) {
                console.warn(`Erro ao verificar SMIL para ${userLogin}:`, sshError.message);
                return false;
            }
        } catch (error) {
            console.error(`Erro ao verificar SMIL para ${userLogin}:`, error);
            return false;
        }
    }

    // Escapar caracteres especiais para XML
    escapeXML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Gerar SMIL para todos os usuários (manutenção)
    async generateAllUsersSMIL() {
        try {
            console.log('🔄 Gerando arquivos SMIL para todos os usuários...');

            // Buscar todos os usuários ativos (streamings e revendas)
            const [userRows] = await db.execute(
                `SELECT DISTINCT 
                    s.codigo_cliente as user_id,
                    s.usuario,
                    f.servidor_id
                 FROM streamings s 
                LEFT JOIN folders f ON s.codigo_cliente = f.user_id
                 WHERE s.status = 1 AND s.usuario IS NOT NULL
                 
                 UNION
                 
                 SELECT DISTINCT
                     r.codigo as user_id,
                     r.usuario,
                     1 as servidor_id
                 FROM revendas r
                 WHERE r.status = 1 AND r.usuario IS NOT NULL`
            );

            const results = [];

            for (const user of userRows) {
                try {
                    const userLogin = user.usuario;
                    const serverId = user.servidor_id || 1;

                    const result = await this.generateUserSMIL(user.user_id, userLogin, serverId);
                    results.push({
                        user_login: userLogin,
                        user_id: user.user_id,
                        server_id: serverId,
                        result: result
                    });
                } catch (userError) {
                    console.error(`Erro ao processar usuário ${user.usuario}:`, userError);
                    results.push({
                        user_login: user.usuario || 'unknown',
                        user_id: user.user_id,
                        result: { success: false, error: userError.message }
                    });
                }
            }

            const successCount = results.filter(r => r.result.success).length;
            console.log(`✅ Arquivos SMIL gerados: ${successCount}/${results.length} usuários`);

            return {
                success: true,
                total_users: results.length,
                success_count: successCount,
                results: results
            };

        } catch (error) {
            console.error('Erro ao gerar SMIL para todos os usuários:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new PlaylistSMILService();