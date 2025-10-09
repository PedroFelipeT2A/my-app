const SSHManager = require('../config/SSHManager');
const db = require('../config/database');
const DigestFetch = require('digest-fetch');

class StreamingControlService {
    constructor() {
        this.jmxCommand = '/usr/bin/java -cp /usr/local/WowzaMediaServer JMXCommandLine -jmx service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi -user admin -pass admin';
    }

    /**
     * Buscar dados do streaming e servidor
     */
    async getStreamingData(login) {
        try {
            const [streamingRows] = await db.execute(
                'SELECT * FROM streamings WHERE usuario = ?',
                [login]
            );

            if (streamingRows.length === 0) {
                throw new Error('Streaming não encontrado');
            }

            const streaming = streamingRows[0];

            const [serverRows] = await db.execute(
                'SELECT * FROM servidores WHERE codigo = ?',
                [streaming.codigo_servidor]
            );

            if (serverRows.length === 0) {
                throw new Error('Servidor não encontrado');
            }

            const server = serverRows[0];

            if (server.status === 'off') {
                throw new Error('Servidor em manutenção');
            }

            return { streaming, server };
        } catch (error) {
            console.error('Erro ao buscar dados do streaming:', error);
            throw error;
        }
    }

    /**
     * Verificar status do streaming
     */
    async checkStreamingStatus(serverIp, serverPassword, login) {
        try {
            const [serverRows] = await db.execute(
                'SELECT codigo FROM servidores WHERE ip = ?',
                [serverIp]
            );

            if (serverRows.length === 0) {
                throw new Error('Servidor não encontrado');
            }

            const serverId = serverRows[0].codigo;

            // Comando para verificar status via JMX
            const command = `${this.jmxCommand} getApplicationInstanceInfo ${login}`;

            try {
                const result = await SSHManager.executeCommand(serverId, command);

                // Verificar se aplicação está carregada/ativa
                if (result.stdout.includes('loaded') || result.stdout.includes('running')) {
                    return { status: 'loaded' };
                } else if (result.stdout.includes('unloaded')) {
                    return { status: 'unloaded' };
                } else {
                    return { status: '' };
                }
            } catch (error) {
                console.warn('Erro ao verificar status via JMX:', error.message);
                return { status: 'unloaded' };
            }
        } catch (error) {
            console.error('Erro ao verificar status do streaming:', error);
            return { status: '' };
        }
    }

    /**
     * Ligar streaming
     */
    async ligarStreaming(login) {
        try {
            const { streaming, server } = await this.getStreamingData(login);

            // Verificar status atual
            const status = await this.checkStreamingStatus(server.ip, server.senha, streaming.login);

            if (status.status === 'loaded') {
                return {
                    success: false,
                    message: 'Streaming já está ligado',
                    alreadyActive: true
                };
            }

            // Executar comando para iniciar aplicação
            const command = `${this.jmxCommand} startAppInstance ${streaming.login}`;
            const result = await SSHManager.executeCommand(server.codigo, command);

            // Verificar se houve erro
            if (result.stdout.includes('ERROR')) {
                throw new Error('Erro ao executar comando de iniciar streaming');
            }

            // Registrar log
            await this.logStreamingAction(streaming.codigo, 'Streaming ligado com sucesso pelo usuário');

            return {
                success: true,
                message: 'Streaming ligado com sucesso'
            };

        } catch (error) {
            console.error('Erro ao ligar streaming:', error);
            return {
                success: false,
                message: error.message || 'Não foi possível ligar o streaming',
                error: error.message
            };
        }
    }

    /**
     * Desligar streaming
     */
    async desligarStreaming(login) {
        try {
            const { streaming, server } = await this.getStreamingData(login);

            // Verificar status atual
            const status = await this.checkStreamingStatus(server.ip, server.senha, streaming.login);

            if (status.status !== 'loaded') {
                return {
                    success: false,
                    message: 'Streaming já está desligado',
                    alreadyInactive: true
                };
            }

            // Executar comando para desligar aplicação
            const command = `${this.jmxCommand} shutdownAppInstance ${streaming.login}`;
            const result = await SSHManager.executeCommand(server.codigo, command);

            // Verificar se houve erro
            if (result.stdout.includes('ERROR')) {
                throw new Error('Erro ao executar comando de desligar streaming');
            }

            // Registrar log
            await this.logStreamingAction(streaming.codigo, 'Streaming desligado com sucesso pelo usuário');

            return {
                success: true,
                message: 'Streaming desligado com sucesso'
            };

        } catch (error) {
            console.error('Erro ao desligar streaming:', error);
            return {
                success: false,
                message: error.message || 'Não foi possível desligar o streaming',
                error: error.message
            };
        }
    }

    /**
     * Reiniciar streaming
     */
    async reiniciarStreaming(login) {
        try {
            const { streaming, server } = await this.getStreamingData(login);

            // Verificar status atual
            const status = await this.checkStreamingStatus(server.ip, server.senha, streaming.login);

            // Se estiver ligado, desligar primeiro
            if (status.status === 'loaded') {
                const shutdownCommand = `${this.jmxCommand} shutdownAppInstance ${streaming.login}`;
                await SSHManager.executeCommand(server.codigo, shutdownCommand);

                // Aguardar 2 segundos
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Iniciar aplicação
            const startCommand = `${this.jmxCommand} startAppInstance ${streaming.login}`;
            const result = await SSHManager.executeCommand(server.codigo, startCommand);

            // Verificar se houve erro
            if (result.stdout.includes('ERROR')) {
                throw new Error('Erro ao executar comando de reiniciar streaming');
            }

            // Registrar log
            await this.logStreamingAction(streaming.codigo, 'Streaming reiniciado com sucesso pelo usuário');

            return {
                success: true,
                message: 'Streaming reiniciado com sucesso'
            };

        } catch (error) {
            console.error('Erro ao reiniciar streaming:', error);
            return {
                success: false,
                message: error.message || 'Não foi possível reiniciar o streaming',
                error: error.message
            };
        }
    }

    /**
     * Bloquear streaming (apenas administradores)
     */
    async bloquearStreaming(login, userType) {
        try {
            // Verificar permissão
            if (!userType || (userType !== 'admin' && userType !== 'revenda')) {
                throw new Error('Acesso não autorizado');
            }

            const { streaming, server } = await this.getStreamingData(login);

            // Bloquear no servidor (renomear Application.xml)
            const blockCommand = `mv -f /usr/local/WowzaMediaServer/conf/${streaming.login}/Application.xml /usr/local/WowzaMediaServer/conf/${streaming.login}/Application.xml.lock; echo OK`;
            await SSHManager.executeCommand(server.codigo, blockCommand);

            // Desligar streaming
            const shutdownCommand = `${this.jmxCommand} shutdownAppInstance ${streaming.login}`;
            await SSHManager.executeCommand(server.codigo, shutdownCommand);

            // Atualizar status no banco
            await db.execute(
                'UPDATE streamings SET status = "2" WHERE codigo = ?',
                [streaming.codigo]
            );

            // Registrar log
            await this.logAction(`[${streaming.login}] Streaming bloqueado com sucesso pelo administrador`);

            return {
                success: true,
                message: 'Streaming bloqueado com sucesso'
            };

        } catch (error) {
            console.error('Erro ao bloquear streaming:', error);
            return {
                success: false,
                message: error.message || 'Não foi possível bloquear o streaming',
                error: error.message
            };
        }
    }

    /**
     * Desbloquear streaming (apenas administradores)
     */
    async desbloquearStreaming(login, userType) {
        try {
            // Verificar permissão
            if (!userType || (userType !== 'admin' && userType !== 'revenda')) {
                throw new Error('Acesso não autorizado');
            }

            const { streaming, server } = await this.getStreamingData(login);

            // Desbloquear no servidor (renomear Application.xml.lock)
            const unblockCommand = `mv -f /usr/local/WowzaMediaServer/conf/${streaming.login}/Application.xml.lock /usr/local/WowzaMediaServer/conf/${streaming.login}/Application.xml; echo OK`;
            await SSHManager.executeCommand(server.codigo, unblockCommand);

            // Desligar (para garantir que não haja conflito)
            const shutdownCommand = `${this.jmxCommand} shutdownAppInstance ${streaming.login}`;
            await SSHManager.executeCommand(server.codigo, shutdownCommand);

            // Aguardar 1 segundo
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Ligar novamente
            const startCommand = `${this.jmxCommand} startAppInstance ${streaming.login}`;
            await SSHManager.executeCommand(server.codigo, startCommand);

            // Atualizar status no banco
            await db.execute(
                'UPDATE streamings SET status = "1" WHERE codigo = ?',
                [streaming.codigo]
            );

            // Registrar log
            await this.logAction(`[${streaming.login}] Streaming desbloqueado com sucesso pelo administrador`);

            return {
                success: true,
                message: 'Streaming desbloqueado com sucesso'
            };

        } catch (error) {
            console.error('Erro ao desbloquear streaming:', error);
            return {
                success: false,
                message: error.message || 'Não foi possível desbloquear o streaming',
                error: error.message
            };
        }
    }

    /**
     * Remover streaming (apenas administradores)
     */
    async removerStreaming(login, userType) {
        try {
            // Verificar permissão
            if (!userType || (userType !== 'admin' && userType !== 'revenda')) {
                throw new Error('Acesso não autorizado');
            }

            const { streaming, server } = await this.getStreamingData(login);

            // Desativar no servidor Wowza
            const deactivateCommand = `/usr/local/WowzaMediaServer/desativar ${streaming.login}`;
            await SSHManager.executeCommand(server.codigo, deactivateCommand);

            // Remover diretório do streaming
            const pathHome = server.path_home || '/home';
            const removeCommand = `nohup rm -rf ${pathHome}/streaming/${streaming.login}; echo ok`;
            await SSHManager.executeCommand(server.codigo, removeCommand);

            // Remover do banco de dados
            await db.execute('DELETE FROM streamings WHERE codigo = ?', [streaming.codigo]);

            // Remover playlists associadas
            const [playlists] = await db.execute(
                'SELECT * FROM playlists WHERE codigo_stm = ?',
                [streaming.codigo]
            );

            for (const playlist of playlists) {
                await db.execute('DELETE FROM playlists WHERE codigo = ?', [playlist.codigo]);
                await db.execute('DELETE FROM playlists_videos WHERE codigo_playlist = ?', [playlist.codigo]);
            }

            // Remover dados relacionados
            await db.execute('DELETE FROM estatisticas WHERE codigo_stm = ?', [streaming.codigo]);
            await db.execute('DELETE FROM playlists_agendamentos WHERE codigo_stm = ?', [streaming.codigo]);
            await db.execute('DELETE FROM logs_streamings WHERE codigo_stm = ?', [streaming.codigo]);
            await db.execute('DELETE FROM dicas_rapidas_acessos WHERE codigo_stm = ?', [streaming.codigo]);

            // Remover app android se existir
            const [apps] = await db.execute(
                'SELECT * FROM apps WHERE codigo_stm = ?',
                [streaming.codigo]
            );

            if (apps.length > 0) {
                await db.execute('DELETE FROM apps WHERE codigo_stm = ?', [streaming.codigo]);
            }

            return {
                success: true,
                message: `Streaming ${streaming.login} removido com sucesso`
            };

        } catch (error) {
            console.error('Erro ao remover streaming:', error);
            return {
                success: false,
                message: error.message || `Não foi possível remover o streaming`,
                error: error.message
            };
        }
    }

    /**
     * Verificar status do streaming (com verificação SRT se habilitado)
     */
    async verificarStatus(login, configData) {
        try {
            const { streaming, server } = await this.getStreamingData(login);

            // Verificar se SRT está habilitado
            if (streaming.srt_status === 'sim') {
                const dominio = configData?.dominio_padrao || 'example.com';
                const servidor = server.nome_principal
                    ? `${server.nome_principal}.${dominio}`
                    : `${server.nome}.${dominio}`;

                const urlSourceSrt = `https://${servidor}/${streaming.login}/srt.stream/playlist.m3u8`;

                try {
                    const response = await fetch(urlSourceSrt, {
                        method: 'HEAD',
                        timeout: 5000
                    });

                    if (response.status === 404) {
                        return { status: 'ligado', message: 'Streaming ligado (aguardando fonte)' };
                    } else if (response.status === 200) {
                        return { status: 'aovivo', message: 'Streaming ao vivo' };
                    } else {
                        return { status: 'desligado', message: 'Streaming desligado' };
                    }
                } catch (fetchError) {
                    console.warn('Erro ao verificar SRT:', fetchError.message);
                }
            }

            // Verificar status normal via JMX
            const status = await this.checkStreamingStatus(server.ip, server.senha, streaming.usuario);

            if (status.status === 'loaded') {
                // TODO: Verificar se há transmissão ao vivo (incoming streams)
                return { status: 'ligado', message: 'Streaming ligado' };
            }

            return { status: 'desligado', message: 'Streaming desligado' };

        } catch (error) {
            console.error('Erro ao verificar status:', error);
            return {
                status: 'erro',
                message: error.message === 'Servidor em manutenção' ? 'manutencao' : 'Erro ao verificar status',
                error: error.message
            };
        }
    }

    /**
     * Registrar ação do streaming
     */
    async logStreamingAction(streamingCodigo, acao) {
        try {
            await db.execute(
                'INSERT INTO logs_streamings (codigo_stm, acao, data_hora) VALUES (?, ?, NOW())',
                [streamingCodigo, acao]
            );
        } catch (error) {
            console.error('Erro ao registrar log:', error);
        }
    }

    /**
     * Registrar ação geral
     */
    async logAction(acao) {
        try {
            await db.execute(
                'INSERT INTO logs (acao, data_hora) VALUES (?, NOW())',
                [acao]
            );
        } catch (error) {
            console.error('Erro ao registrar log geral:', error);
        }
    }

    /**
     * Recarregar playlists/agendamentos no Wowza sem reiniciar streaming
     * Equivalente à função PHP recarregar_playlists_agendamentos()
     */
    async recarregarPlaylistsAgendamentos(login) {
        try {
            const { streaming, server } = await this.getStreamingData(login);

            // Usar domínio correto do Wowza e credenciais
            const wowzaHost = 'stmv1.udicast.com';
            const wowzaUser = 'admin';
            const wowzaPassword = 'FK38Ca2SuE6jvJXed97VMn';

            // URL do endpoint Wowza schedules
            const url = `http://${wowzaHost}:555/schedules?appName=${login}&action=reloadSchedule`;

            console.log(`🔄 Recarregando playlists para: ${login}`);
            console.log(`📍 URL: ${url}`);

            // Criar cliente Digest Fetch com credenciais corretas
            const client = new DigestFetch(wowzaUser, wowzaPassword, {
                algorithm: 'MD5'
            });

            // Fazer requisição com retry
            let retries = 0;
            const maxRetries = 10;
            let lastError = null;

            while (retries < maxRetries) {
                try {
                    const response = await client.fetch(url, {
                        method: 'GET',
                        headers: {
                            'User-Agent': 'Painel de Streaming 3.0.0'
                        }
                    });

                    if (response.ok) {
                        const text = await response.text();

                        if (text.includes('DONE')) {
                            console.log(`✅ Playlists recarregadas com sucesso para ${login}`);

                            // Registrar log
                            await this.logStreamingAction(
                                streaming.codigo,
                                'Playlists/agendamentos recarregados sem reiniciar streaming'
                            );

                            return {
                                success: true,
                                message: 'Playlists recarregadas com sucesso',
                                login: login
                            };
                        } else {
                            console.warn(`⚠️ Resposta inesperada do Wowza: ${text}`);
                            lastError = `Resposta inesperada: ${text}`;
                        }
                    } else {
                        console.warn(`⚠️ Status HTTP ${response.status}: ${response.statusText}`);
                        lastError = `HTTP ${response.status}: ${response.statusText}`;
                    }

                    // Incrementar retry e aguardar
                    retries++;
                    if (retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }

                } catch (fetchError) {
                    console.warn(`Tentativa ${retries + 1}/${maxRetries} falhou:`, fetchError.message);
                    lastError = fetchError.message;
                    retries++;

                    if (retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }

            // Se chegou aqui, todas as tentativas falharam
            return {
                success: false,
                message: `Falha após ${maxRetries} tentativas`,
                error: lastError
            };

        } catch (error) {
            console.error('Erro ao recarregar playlists:', error);
            return {
                success: false,
                message: error.message || 'Não foi possível recarregar as playlists',
                error: error.message
            };
        }
    }


    /**
     * Decodificar senha (implementação básica - ajustar conforme o code_decode do PHP)
     */
    decodePassword(encodedPassword) {
        // Por enquanto, retornar a senha sem decodificação
        // Se o sistema PHP usa code_decode($senha, "D"), implementar a lógica aqui
        return encodedPassword;
    }
}

module.exports = new StreamingControlService();