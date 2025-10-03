const fetch = require('node-fetch');
const db = require('./database');
const SSHManager = require('./SSHManager');

class WowzaLiveManager {
    constructor() {
        this.baseUrl = '';
        this.username = 'admin';
        this.password = '';
        this.initialized = false;
    }

    async initializeFromDatabase(userId) {
        try {
            // Buscar configurações do servidor Wowza incluindo credenciais da API
            const [serverRows] = await db.execute(
                `SELECT ws.ip, ws.dominio, ws.porta_api, ws.usuario_api, ws.senha_api
                 FROM wowza_servers ws
                 JOIN streamings s ON ws.codigo = COALESCE(s.codigo_servidor, 1)
                 WHERE s.codigo_cliente = ? AND ws.status = 'ativo'
                 LIMIT 1`,
                [userId]
            );

            if (serverRows.length === 0) {
                // Usar servidor padrão
                this.baseUrl = 'http://51.222.156.223:8087';
                this.username = 'admin';
                this.password = 'admin';
            } else {
                const server = serverRows[0];
                const host = server.dominio || server.ip;
                const port = server.porta_api || 8087;
                this.baseUrl = `http://${host}:${port}`;
                this.username = server.usuario_api || 'admin';
                this.password = server.senha_api || 'admin';
            }

            this.initialized = true;
            console.log(`✅ WowzaLiveManager inicializado: ${this.baseUrl}`);
            return true;
        } catch (error) {
            console.error('Erro ao inicializar WowzaLiveManager:', error);
            return false;
        }
    }

    // Função principal para gerenciar lives no Wowza (baseada no PHP)
    async gerenciarLiveWowza(servidor, senha, login, live, acao) {
        try {
            // Construir URL exatamente como no PHP
            const url = `http://${servidor}:6980/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/${login}/pushpublish/mapentries/${live}/actions/${acao}`;
            
            console.log(`🔧 Gerenciando live Wowza: ${url}`);
            console.log(`📋 Parâmetros: servidor=${servidor}, login=${login}, live=${live}, acao=${acao}`);

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`admin:${senha}`).toString('base64')}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 20000
            });

            const responseText = await response.text();
            console.log(`📊 Resposta Wowza (${response.status}):`, responseText);

            // Verificar se foi bem-sucedido (como no PHP)
            if (responseText.toLowerCase().includes('successfully') || response.ok) {
                console.log(`✅ Ação ${acao} executada com sucesso para live ${live}`);
                return 'ok';
            } else {
                console.error(`❌ Erro na ação ${acao} para live ${live}: ${responseText}`);
                return 'erro';
            }
        } catch (error) {
            console.error('Erro ao gerenciar live Wowza:', error);
            return 'erro';
        }
    }

    // Iniciar live seguindo exatamente o padrão PHP
    async iniciarLive(userId, liveData) {
        try {
            const { tipo, servidor_rtmp, servidor_rtmp_chave, servidor_stm, data_inicio, data_fim, inicio_imediato } = liveData;

            console.log(`🚀 Iniciando live para usuário ${userId}:`, liveData);

            // Buscar dados do usuário (incluindo revendas)
            let userRows = [];
            
            // Primeiro tentar em streamings
            [userRows] = await db.execute(
                'SELECT codigo, codigo_cliente, usuario, email, codigo_servidor FROM streamings WHERE codigo_cliente = ? AND status = 1 LIMIT 1',
                [userId]
            );

            // Se não encontrou em streamings, buscar em revendas
            if (userRows.length === 0) {
                [userRows] = await db.execute(
                    'SELECT codigo, codigo as codigo_cliente, usuario, email, 1 as codigo_servidor FROM revendas WHERE codigo = ? AND status = 1 LIMIT 1',
                    [userId]
                );
            }

            if (userRows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const userData = userRows[0];
            const userLogin = userData.usuario || (userData.email ? userData.email.split('@')[0] : `user_${userId}`);

            // Buscar dados do servidor
            const [serverRows] = await db.execute(
                'SELECT ip, dominio, senha_root, porta_ssh FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
                [userData.codigo_servidor || 1]
            );

            if (serverRows.length === 0) {
                throw new Error('Servidor não encontrado');
            }

            const serverData = serverRows[0];
            const servidor = serverData.dominio || serverData.ip;
            const senhaServidor = serverData.senha_root;

            // Construir source RTMP como no PHP
            const sourceRtmp = `rtmp://${servidor}:1935/${userLogin}/${userLogin}`;

            // Extrair servidor e app da URL RTMP como no PHP
            const liveServidor = servidor_rtmp.replace(/^rtmps?:\/\//, '').split('/')[0];
            const liveApp = servidor_rtmp.replace(/^rtmps?:\/\//, '').substring(
                servidor_rtmp.replace(/^rtmps?:\/\//, '').indexOf('/') + 1
            );

            // Converter datas do formato brasileiro para MySQL como no PHP
            const dataInicioMySQL = data_inicio ? 
                data_inicio.replace(/(\d{2})\/(\d{2})\/(\d{4})\s(.*)/, '$3-$2-$1 $4') + ':00' :
                new Date().toISOString().slice(0, 19).replace('T', ' ');

            const dataFimMySQL = data_fim.replace(/(\d{2})\/(\d{2})\/(\d{4})\s(.*)/, '$3-$2-$1 $4') + ':00';

            // Inserir live na tabela como no PHP
            const [result] = await db.execute(
                `INSERT INTO lives (codigo_stm, data_inicio, data_fim, tipo, live_servidor, live_app, live_chave, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, '2')`,
                [userData.codigo, dataInicioMySQL, dataFimMySQL, tipo, liveServidor, liveApp, servidor_rtmp_chave]
            );

            const codigoLive = result.insertId;

            // Se início imediato, iniciar transmissão agora
            if (inicio_imediato === 'sim' || !data_inicio) {
                console.log(`🎬 Iniciando transmissão imediata para ${userLogin} - Live ID: ${codigoLive}`);

                // Obter conexão SSH
                const { conn } = await SSHManager.getConnection(userData.codigo_servidor || 1);

                let comando = '';
                let grepPattern = '';

                if (tipo === 'facebook') {
                    // Facebook usa configuração especial como no PHP
                    comando = `echo OK;screen -dmS ${userLogin}_${codigoLive} bash -c "/usr/local/bin/ffmpeg -re -i ${sourceRtmp} -c:v copy -c:a copy -bsf:a aac_adtstoasc -preset ultrafast -strict experimental -threads 1 -f flv 'rtmps://live-api-s.facebook.com:443/rtmp/${servidor_rtmp_chave}'; exec sh"`;
                    grepPattern = `/bin/ps aux | /bin/grep ffmpeg | /bin/grep rtmp | /bin/grep ${userLogin} | /bin/grep facebook | /usr/bin/wc -l`;
                } else if (tipo === 'tiktok' || tipo === 'kwai') {
                    // TikTok/Kwai usa crop vertical como no PHP
                    const servidorLiveTiktokKwai = `${servidor_rtmp}/${servidor_rtmp_chave}`;
                    comando = `echo OK;screen -dmS ${userLogin}_${codigoLive} bash -c "/usr/local/bin/ffmpeg -re -i ${sourceRtmp} -vf 'crop=ih*(9/16):ih' -crf 21 -r 24 -g 48 -b:v 3000000 -b:a 128k -ar 44100 -acodec aac -vcodec libx264 -preset ultrafast -bufsize '(6.000*3000000)/8' -maxrate 3500000 -threads 1 -f flv '${servidorLiveTiktokKwai}'; exec sh"`;
                    grepPattern = `/bin/ps aux | /bin/grep ffmpeg | /bin/grep rtmp | /bin/grep ${userLogin} | /bin/grep 'tiktok\\|kwai' | /usr/bin/wc -l`;
                } else {
                    // Outras plataformas usam PushPublishMap.txt como no PHP
                    const live = `${tipo}_${codigoLive}`;
                    const liveTarget = `${userLogin}={"entryName":"${live}", "profile":"rtmp", "application":"${liveApp.replace(/\//g, '')}", "host":"${liveServidor.replace(/\//g, '')}", "streamName":"${servidor_rtmp_chave}"}`;

                    // Adicionar ao PushPublishMap.txt
                    const addMapCommand = `echo '${liveTarget}' >> /usr/local/WowzaStreamingEngine/conf/${userLogin}/PushPublishMap.txt;echo OK`;
                    await SSHManager.executeCommand(userData.codigo_servidor || 1, addMapCommand);

                    // Usar API do Wowza para restart
                    const resultado = await this.gerenciarLiveWowza(servidor, senhaServidor, userLogin, live, 'restart');
                    
                    if (resultado === 'ok') {
                        // Atualizar status no banco
                        await db.execute(
                            'UPDATE lives SET status = "1", data_inicio = NOW() WHERE codigo = ?',
                            [codigoLive]
                        );

                        console.log(`✅ Live ${live} iniciada com sucesso via Wowza API`);
                        return {
                            success: true,
                            live_id: codigoLive,
                            message: 'Live iniciada com sucesso',
                            method: 'wowza_api'
                        };
                    } else {
                        // Marcar como erro
                        await db.execute(
                            'UPDATE lives SET status = "0" WHERE codigo = ?',
                            [codigoLive]
                        );

                        console.error(`❌ Erro ao iniciar live ${live} via Wowza API`);
                        return {
                            success: false,
                            error: 'Erro ao iniciar live via Wowza API',
                            method: 'wowza_api'
                        };
                    }
                }

                // Para Facebook, TikTok e Kwai, executar comando SSH e verificar processo
                if (tipo === 'facebook' || tipo === 'tiktok' || tipo === 'kwai') {
                    console.log(`📋 Executando comando SSH: ${comando}`);
                    await SSHManager.executeCommand(userData.codigo_servidor || 1, comando);

                    // Aguardar 5 segundos como no PHP
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Verificar se processo está rodando
                    console.log(`🔍 Verificando processo: ${grepPattern}`);
                    const checkResult = await SSHManager.executeCommand(userData.codigo_servidor || 1, grepPattern);
                    const processCount = parseInt(checkResult.stdout.trim()) || 0;

                    console.log(`📊 Processos encontrados: ${processCount}`);

                    if (processCount > 0) {
                        // Transmissão iniciada com sucesso
                        await db.execute(
                            'UPDATE lives SET status = "1", data_inicio = NOW() WHERE codigo = ?',
                            [codigoLive]
                        );

                        console.log(`✅ Live ${codigoLive} iniciada com sucesso - Processos: ${processCount}`);
                        return {
                            success: true,
                            live_id: codigoLive,
                            message: 'Live iniciada com sucesso',
                            method: 'ssh_screen',
                            process_count: processCount
                        };
                    } else {
                        // Erro ao iniciar transmissão
                        await db.execute(
                            'UPDATE lives SET status = "0" WHERE codigo = ?',
                            [codigoLive]
                        );

                        console.error(`❌ Erro ao iniciar live ${codigoLive} - Nenhum processo encontrado`);
                        return {
                            success: false,
                            error: 'Erro ao iniciar live, tente novamente',
                            method: 'ssh_screen',
                            process_count: 0,
                            debug_info: {
                                comando_executado: comando,
                                grep_pattern: grepPattern,
                                check_result: checkResult.stdout
                            }
                        };
                    }
                }
            } else {
                // Live agendada
                console.log(`📅 Live ${codigoLive} agendada com sucesso`);
                return {
                    success: true,
                    live_id: codigoLive,
                    message: 'Live agendada com sucesso',
                    method: 'scheduled'
                };
            }

        } catch (error) {
            console.error('Erro ao iniciar live:', error);
            return {
                success: false,
                error: error.message || 'Erro interno ao iniciar live'
            };
        }
    }

    // Finalizar live seguindo padrão PHP
    async finalizarLive(userId, codigoLive) {
        try {
            console.log(`🛑 Finalizando live ${codigoLive} para usuário ${userId}`);

            // Buscar dados da live
            const [liveRows] = await db.execute(
                'SELECT * FROM lives WHERE codigo = ? AND codigo_stm = ?',
                [codigoLive, userId]
            );

            if (liveRows.length === 0) {
                throw new Error('Live não encontrada');
            }

            const dadosLive = liveRows[0];

            // Buscar dados do usuário e servidor
            let userRows = [];
            
            // Primeiro tentar em streamings
            [userRows] = await db.execute(
                'SELECT codigo, codigo_cliente, usuario, email, codigo_servidor FROM streamings WHERE codigo_cliente = ? AND status = 1 LIMIT 1',
                [userId]
            );

            // Se não encontrou em streamings, buscar em revendas
            if (userRows.length === 0) {
                [userRows] = await db.execute(
                    'SELECT codigo, codigo as codigo_cliente, usuario, email, 1 as codigo_servidor FROM revendas WHERE codigo = ? AND status = 1 LIMIT 1',
                    [userId]
                );
            }

            if (userRows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const userData = userRows[0];
            const userLogin = userData.usuario || (userData.email ? userData.email.split('@')[0] : `user_${userId}`);

            // Buscar dados do servidor
            const [serverRows] = await db.execute(
                'SELECT ip, dominio, senha_root, porta_ssh FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
                [userData.codigo_servidor || 1]
            );

            if (serverRows.length === 0) {
                throw new Error('Servidor não encontrado');
            }

            const serverData = serverRows[0];
            const servidor = serverData.dominio || serverData.ip;
            const senhaServidor = serverData.senha_root;

            if (dadosLive.tipo === 'facebook' || dadosLive.tipo === 'tiktok' || dadosLive.tipo === 'kwai') {
                // Para Facebook, TikTok e Kwai, finalizar screen session como no PHP
                const killCommand = `echo OK;screen -ls | grep -o '[0-9]*\\.${userLogin}_${dadosLive.codigo}\\>' | xargs -I{} screen -X -S {} quit`;
                
                console.log(`🛑 Finalizando screen session: ${killCommand}`);
                await SSHManager.executeCommand(userData.codigo_servidor || 1, killCommand);
            } else {
                // Para outras plataformas, usar API do Wowza como no PHP
                const live = `${dadosLive.tipo}_${dadosLive.codigo}`;
                const resultado = await this.gerenciarLiveWowza(servidor, senhaServidor, userLogin, live, 'disable');
                
                console.log(`📊 Resultado da finalização via Wowza API: ${resultado}`);
            }

            // Atualizar status no banco
            await db.execute(
                'UPDATE lives SET status = "0", data_fim = NOW() WHERE codigo = ?',
                [dadosLive.codigo]
            );

            console.log(`✅ Live ${codigoLive} finalizada com sucesso`);

            return {
                success: true,
                message: `Live finalizada com sucesso. Agora você deve finalizar a transmissão na sua conta do ${dadosLive.tipo}`,
                live_id: codigoLive,
                platform: dadosLive.tipo
            };

        } catch (error) {
            console.error('Erro ao finalizar live:', error);
            return {
                success: false,
                error: error.message || 'Erro ao finalizar live'
            };
        }
    }

    // Remover live seguindo padrão PHP
    async removerLive(userId, codigoLive) {
        try {
            console.log(`🗑️ Removendo live ${codigoLive} para usuário ${userId}`);

            // Buscar dados da live
            const [liveRows] = await db.execute(
                'SELECT * FROM lives WHERE codigo = ? AND codigo_stm = ?',
                [codigoLive, userId]
            );

            if (liveRows.length === 0) {
                throw new Error('Live não encontrada');
            }

            const dadosLive = liveRows[0];

            // Buscar dados do usuário e servidor (mesmo código da finalização)
            let userRows = [];
            
            [userRows] = await db.execute(
                'SELECT codigo, codigo_cliente, usuario, email, codigo_servidor FROM streamings WHERE codigo_cliente = ? AND status = 1 LIMIT 1',
                [userId]
            );

            if (userRows.length === 0) {
                [userRows] = await db.execute(
                    'SELECT codigo, codigo as codigo_cliente, usuario, email, 1 as codigo_servidor FROM revendas WHERE codigo = ? AND status = 1 LIMIT 1',
                    [userId]
                );
            }

            if (userRows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const userData = userRows[0];
            const userLogin = userData.usuario || (userData.email ? userData.email.split('@')[0] : `user_${userId}`);

            // Buscar dados do servidor
            const [serverRows] = await db.execute(
                'SELECT ip, dominio, senha_root, porta_ssh FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
                [userData.codigo_servidor || 1]
            );

            if (serverRows.length === 0) {
                throw new Error('Servidor não encontrado');
            }

            const serverData = serverRows[0];
            const servidor = serverData.dominio || serverData.ip;
            const senhaServidor = serverData.senha_root;

            // Remover do banco primeiro
            await db.execute(
                'DELETE FROM lives WHERE codigo = ?',
                [dadosLive.codigo]
            );

            if (dadosLive.tipo === 'facebook' || dadosLive.tipo === 'tiktok' || dadosLive.tipo === 'kwai') {
                // Para Facebook, TikTok e Kwai, finalizar screen session
                const killCommand = `echo OK;screen -ls | grep -o '[0-9]*\\.${userLogin}_${dadosLive.codigo}\\>' | xargs -I{} screen -X -S {} quit`;
                
                console.log(`🛑 Finalizando screen session: ${killCommand}`);
                await SSHManager.executeCommand(userData.codigo_servidor || 1, killCommand);
            } else {
                // Para outras plataformas, usar API do Wowza e remover do PushPublishMap.txt
                const live = `${dadosLive.tipo}_${dadosLive.codigo}`;
                
                // Desabilitar via API
                const resultado = await this.gerenciarLiveWowza(servidor, senhaServidor, userLogin, live, 'disable');
                console.log(`📊 Resultado da desabilitação via Wowza API: ${resultado}`);
                
                // Remover do PushPublishMap.txt como no PHP
                const removeMapCommand = `echo OK;sed -i '/${live}/d' /usr/local/WowzaStreamingEngine/conf/${userLogin}/PushPublishMap.txt`;
                await SSHManager.executeCommand(userData.codigo_servidor || 1, removeMapCommand);
            }

            console.log(`✅ Live ${codigoLive} removida com sucesso`);

            return {
                success: true,
                message: 'Live removida com sucesso',
                live_id: codigoLive
            };

        } catch (error) {
            console.error('Erro ao remover live:', error);
            return {
                success: false,
                error: error.message || 'Erro ao remover live'
            };
        }
    }

    // Reiniciar live seguindo padrão PHP
    async reiniciarLive(userId, codigoLive) {
        try {
            console.log(`🔄 Reiniciando live ${codigoLive} para usuário ${userId}`);

            // Buscar dados da live
            const [liveRows] = await db.execute(
                'SELECT * FROM lives WHERE codigo = ? AND codigo_stm = ?',
                [codigoLive, userId]
            );

            if (liveRows.length === 0) {
                throw new Error('Live não encontrada');
            }

            const dadosLive = liveRows[0];

            // Buscar dados do usuário e servidor (mesmo código das outras funções)
            let userRows = [];
            
            [userRows] = await db.execute(
                'SELECT codigo, codigo_cliente, usuario, email, codigo_servidor FROM streamings WHERE codigo_cliente = ? AND status = 1 LIMIT 1',
                [userId]
            );

            if (userRows.length === 0) {
                [userRows] = await db.execute(
                    'SELECT codigo, codigo as codigo_cliente, usuario, email, 1 as codigo_servidor FROM revendas WHERE codigo = ? AND status = 1 LIMIT 1',
                    [userId]
                );
            }

            if (userRows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const userData = userRows[0];
            const userLogin = userData.usuario || (userData.email ? userData.email.split('@')[0] : `user_${userId}`);

            // Buscar dados do servidor
            const [serverRows] = await db.execute(
                'SELECT ip, dominio, senha_root, porta_ssh FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
                [userData.codigo_servidor || 1]
            );

            if (serverRows.length === 0) {
                throw new Error('Servidor não encontrado');
            }

            const serverData = serverRows[0];
            const servidor = serverData.dominio || serverData.ip;
            const senhaServidor = serverData.senha_root;

            const live = `${dadosLive.tipo}_${dadosLive.codigo}`;
            
            // Reiniciar via API do Wowza
            const resultado = await this.gerenciarLiveWowza(servidor, senhaServidor, userLogin, live, 'restart');

            if (resultado === 'ok') {
                // Atualizar status no banco
                await db.execute(
                    'UPDATE lives SET status = "1", data_inicio = NOW() WHERE codigo = ?',
                    [dadosLive.codigo]
                );

                console.log(`✅ Live ${codigoLive} reiniciada com sucesso`);
                return {
                    success: true,
                    message: 'Live reiniciada com sucesso',
                    live_id: codigoLive
                };
            } else {
                // Marcar como erro
                await db.execute(
                    'UPDATE lives SET status = "0" WHERE codigo = ?',
                    [dadosLive.codigo]
                );

                console.error(`❌ Erro ao reiniciar live ${codigoLive}`);
                return {
                    success: false,
                    error: 'Erro ao tentar reiniciar a live. Remova e cadastre uma nova.',
                    live_id: codigoLive
                };
            }

        } catch (error) {
            console.error('Erro ao reiniciar live:', error);
            return {
                success: false,
                error: error.message || 'Erro ao reiniciar live'
            };
        }
    }

    // Verificar status de uma live específica
    async verificarStatusLive(userId, codigoLive) {
        try {
            // Buscar dados da live
            const [liveRows] = await db.execute(
                'SELECT * FROM lives WHERE codigo = ? AND codigo_stm = ?',
                [codigoLive, userId]
            );

            if (liveRows.length === 0) {
                return {
                    success: false,
                    error: 'Live não encontrada'
                };
            }

            const dadosLive = liveRows[0];

            // Buscar dados do usuário
            let userRows = [];
            
            [userRows] = await db.execute(
                'SELECT codigo, codigo_cliente, usuario, email, codigo_servidor FROM streamings WHERE codigo_cliente = ? AND status = 1 LIMIT 1',
                [userId]
            );

            if (userRows.length === 0) {
                [userRows] = await db.execute(
                    'SELECT codigo, codigo as codigo_cliente, usuario, email, 1 as codigo_servidor FROM revendas WHERE codigo = ? AND status = 1 LIMIT 1',
                    [userId]
                );
            }

            if (userRows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const userData = userRows[0];
            const userLogin = userData.usuario || (userData.email ? userData.email.split('@')[0] : `user_${userId}`);

            // Verificar se processo ainda está rodando (para Facebook, TikTok, Kwai)
            if (dadosLive.tipo === 'facebook' || dadosLive.tipo === 'tiktok' || dadosLive.tipo === 'kwai') {
                const grepPattern = `/bin/ps aux | /bin/grep ffmpeg | /bin/grep rtmp | /bin/grep ${userLogin} | /bin/grep '${dadosLive.tipo}' | /usr/bin/wc -l`;
                const checkResult = await SSHManager.executeCommand(userData.codigo_servidor || 1, grepPattern);
                const processCount = parseInt(checkResult.stdout.trim()) || 0;

                const isActive = processCount > 0 && dadosLive.status === '1';

                return {
                    success: true,
                    live_data: dadosLive,
                    is_active: isActive,
                    process_count: processCount,
                    method: 'ssh_screen'
                };
            } else {
                // Para outras plataformas, verificar via API do Wowza
                const live = `${dadosLive.tipo}_${dadosLive.codigo}`;
                
                // Buscar dados do servidor
                
                const [serverRows] = await db.execute(
                    'SELECT ip, dominio, senha_root FROM wowza_servers WHERE codigo = ? AND status = "ativo"',
                    [userData.codigo_servidor || 1]
                );

                if (serverRows.length > 0) {
                    const serverData = serverRows[0];
                    const servidor = serverData.dominio || serverData.ip;
                    const senhaServidor = serverData.senha_root;

                    // Verificar status via API (implementar se necessário)
                    const isActive = dadosLive.status === '1';

                    return {
                        success: true,
                        live_data: dadosLive,
                        is_active: isActive,
                        method: 'wowza_api'
                    };
                }
            }

            return {
                success: true,
                live_data: dadosLive,
                is_active: dadosLive.status === '1',
                method: 'database_only'
            };

        } catch (error) {
            console.error('Erro ao verificar status da live:', error);
            return {
                success: false,
                error: error.message || 'Erro ao verificar status da live'
            };
        }
    }

    // Listar lives ativas do usuário
    async listarLivesAtivas(userId) {
        try {
            // Buscar lives ativas do usuário (incluindo revendas)
            const [liveRows] = await db.execute(
                `SELECT l.*, 
                        CASE 
                            WHEN s.usuario IS NOT NULL THEN s.usuario
                            WHEN s.email IS NOT NULL THEN SUBSTRING_INDEX(s.email, '@', 1)
                            WHEN r.usuario IS NOT NULL THEN r.usuario
                            WHEN r.email IS NOT NULL THEN SUBSTRING_INDEX(r.email, '@', 1)
                            ELSE CONCAT('user_', l.codigo_stm)
                        END as user_login
                 FROM lives l
                 LEFT JOIN streamings s ON l.codigo_stm = s.codigo_cliente
                 LEFT JOIN revendas r ON l.codigo_stm = r.codigo
                 WHERE l.codigo_stm = ? AND l.status = '1'
                 ORDER BY l.data_inicio DESC`,
                [userId]
            );

            return {
                success: true,
                lives: liveRows
            };

        } catch (error) {
            console.error('Erro ao listar lives ativas:', error);
            return {
                success: false,
                error: error.message || 'Erro ao listar lives ativas',
                lives: []
            };
        }
    }
}

module.exports = new WowzaLiveManager();