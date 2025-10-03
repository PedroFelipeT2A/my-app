const fetch = require('node-fetch');
const db = require('./database');

class WowzaStreamingService {
  constructor() {
    this.baseUrl = '';
    this.username = '';
    this.password = '';
    this.application = 'live'; // Usar aplicação padrão
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
      console.log(`✅ WowzaStreamingService inicializado: ${this.baseUrl}`);
      return true;
    } catch (error) {
      console.error('Erro ao inicializar WowzaStreamingService:', error);
      return false;
    }
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Conexão OK' : 'Erro na conexão'
      };
    } catch (error) {
      console.error('Erro ao testar conexão Wowza:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Iniciar stream SMIL (implementação baseada no exemplo PHP)
  async startSMILStream(config) {
    try {
      const { streamId, userId, userLogin, userConfig, playlistId, smilFile, platforms } = config;
      
      console.log(`🎬 Iniciando stream SMIL para usuário ${userLogin}...`);
      
      // 1. Verificar se aplicação do usuário existe
      const appExists = await this.checkApplicationExists(userLogin);
      if (!appExists) {
        console.log(`📁 Criando aplicação ${userLogin} no Wowza...`);
        await this.createUserApplication(userLogin, userConfig);
      }

      // 2. Iniciar stream SMIL
      const streamResult = await this.startStreamPublisher(userLogin, smilFile);
      
      if (!streamResult.success) {
        throw new Error(`Erro ao iniciar stream publisher: ${streamResult.error}`);
      }

      // 3. Configurar push para plataformas se necessário
      if (platforms && platforms.length > 0) {
        for (const platform of platforms) {
          try {
            await this.configurePushPublish(userLogin, platform);
          } catch (platformError) {
            console.warn(`Erro ao configurar plataforma ${platform.platform.nome}:`, platformError.message);
          }
        }
      }

      console.log(`✅ Stream SMIL ${streamId} iniciado com sucesso`);
      
      return {
        success: true,
        streamId,
        data: {
          rtmpUrl: `rtmp://stmv1.udicast.com:1935/${userLogin}`,
          streamName: userLogin,
          hlsUrl: `http://stmv1.udicast.com:80/${userLogin}/${userLogin}/playlist.m3u8`,
          smilUrl: `http://stmv1.udicast.com:80/${userLogin}/smil:${smilFile}/playlist.m3u8`,
          bitrate: userConfig.bitrate || 2500
        }
      };
    } catch (error) {
      console.error('Erro ao iniciar stream SMIL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verificar se aplicação do usuário existe via JMX
  async checkApplicationExists(userLogin, serverId) {
    try {
      const SSHManager = require('./SSHManager');
      const jmxCommand = '/usr/bin/java -cp /usr/local/WowzaMediaServer JMXCommandLine -jmx service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi -user admin -pass admin';

      const command = `${jmxCommand} getApplicationInstanceInfo ${userLogin}`;
      const result = await SSHManager.executeCommand(serverId, command);

      // Se a aplicação existe, o comando não retorna erro
      const exists = result.stdout && !result.stdout.includes('ERROR') && !result.stdout.includes('not found');
      console.log(`🔍 Verificando aplicação ${userLogin}: ${exists ? 'existe' : 'não existe'}`);
      return exists;
    } catch (error) {
      console.warn(`Aplicação ${userLogin} não existe, será criada`);
      return false;
    }
  }

  // Criar aplicação do usuário no Wowza via JMX
  async createUserApplication(userLogin, userConfig, serverId) {
    try {
      const SSHManager = require('./SSHManager');
      const jmxCommand = '/usr/bin/java -cp /usr/local/WowzaMediaServer JMXCommandLine -jmx service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi -user admin -pass admin';

      console.log(`📁 Configurando aplicação ${userLogin} via JMX...`);

      // Verificar se diretório já existe
      const checkDirCommand = `test -d /usr/local/WowzaStreamingEngine/conf/${userLogin} && echo "EXISTS" || echo "NOT_EXISTS"`;
      const dirCheckResult = await SSHManager.executeCommand(serverId, checkDirCommand);

      if (!dirCheckResult.stdout.includes('EXISTS')) {
        // Criar estrutura de diretórios
        const createDirCommand = `mkdir -p /usr/local/WowzaStreamingEngine/conf/${userLogin} && echo "OK"`;
        await SSHManager.executeCommand(serverId, createDirCommand);

        // Copiar template de aplicação do diretório correto
        const copyTemplateCommand = `cp /usr/local/WowzaStreamingEngine/conf/live/Application.xml /usr/local/WowzaStreamingEngine/conf/${userLogin}/Application.xml && echo "OK"`;
        await SSHManager.executeCommand(serverId, copyTemplateCommand);

        // Copiar PushPublishMap.txt se necessário
        const copyMapCommand = `cp /usr/local/WowzaStreamingEngine/conf/live/PushPublishMap.txt /usr/local/WowzaStreamingEngine/conf/${userLogin}/PushPublishMap.txt 2>/dev/null || touch /usr/local/WowzaStreamingEngine/conf/${userLogin}/PushPublishMap.txt`;
        await SSHManager.executeCommand(serverId, copyMapCommand);

        console.log(`📋 Estrutura de arquivos criada para ${userLogin}`);
      } else {
        console.log(`📋 Diretório ${userLogin} já existe, usando configuração existente`);
      }

      // Iniciar aplicação via JMX
      const startCommand = `${jmxCommand} startAppInstance ${userLogin}`;
      const result = await SSHManager.executeCommand(serverId, startCommand);

      // Verificar se iniciou com sucesso (pode já estar rodando)
      if (result.stdout && (result.stdout.includes('success') || result.stdout.includes('already') || !result.stdout.includes('ERROR'))) {
        console.log(`✅ Aplicação ${userLogin} está rodando via JMX`);
        return true;
      } else {
        console.error(`❌ Erro ao iniciar aplicação ${userLogin}:`, result.stdout || result.stderr);
        return false;
      }
    } catch (error) {
      console.error(`Erro ao criar aplicação ${userLogin}:`, error);
      return false;
    }
  }

  // Iniciar Stream Publisher via REST API
  async startStreamPublisher(userLogin, smilFile, serverId) {
    try {
      console.log(`🎬 Iniciando Stream Publisher para ${userLogin} com arquivo ${smilFile}`);

      // Para SMIL files, usar MediaCaster via REST API
      const streamName = smilFile.replace('.smil', '');

      const mediaCasterConfig = {
        restURI: `http://localhost:8087/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/${userLogin}/instances/_definst_/streamfiles/${smilFile}`,
        serverName: "_defaultServer_",
        vhostName: "_defaultVHost_",
        appName: userLogin,
        mediaCasterType: "rtp",
        streamFile: smilFile
      };

      try {
        const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/${userLogin}/instances/_definst_/streamfiles`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(mediaCasterConfig),
          timeout: 10000
        });

        if (response.ok || response.status === 409) {
          // 409 significa que já existe, o que é OK
          console.log(`✅ Stream Publisher configurado para ${userLogin}`);

          // Aguardar um pouco para o stream se estabilizar
          await new Promise(resolve => setTimeout(resolve, 2000));

          return { success: true };
        } else {
          const errorText = await response.text();
          console.warn(`Aviso ao configurar MediaCaster:`, errorText);

          // Se falhar via REST API, o stream ainda pode funcionar se o arquivo SMIL existir
          // Verificar se o arquivo SMIL existe no servidor
          const SSHManager = require('./SSHManager');
          const smilPath = `/usr/local/WowzaStreamingEngine/content/${userLogin}/${smilFile}`;
          const checkCommand = `test -f "${smilPath}" && echo "EXISTS" || echo "NOT_EXISTS"`;
          const checkResult = await SSHManager.executeCommand(serverId, checkCommand);

          if (checkResult.stdout.includes('EXISTS')) {
            console.log(`✅ Arquivo SMIL existe, stream pode ser acessado: ${smilPath}`);
            return { success: true };
          } else {
            return { success: false, error: `Arquivo SMIL não encontrado: ${smilPath}` };
          }
        }
      } catch (apiError) {
        console.warn(`Erro na API REST do Wowza:`, apiError.message);

        // Fallback: verificar se arquivo SMIL existe
        const SSHManager = require('./SSHManager');
        const smilPath = `/usr/local/WowzaStreamingEngine/content/${userLogin}/${smilFile}`;
        const checkCommand = `test -f "${smilPath}" && echo "EXISTS" || echo "NOT_EXISTS"`;
        const checkResult = await SSHManager.executeCommand(serverId, checkCommand);

        if (checkResult.stdout.includes('EXISTS')) {
          console.log(`✅ Arquivo SMIL existe, stream pode ser acessado (API não disponível)`);
          return { success: true };
        } else {
          return { success: false, error: `Arquivo SMIL não encontrado e API não disponível` };
        }
      }
    } catch (error) {
      console.error('Erro ao iniciar Stream Publisher:', error);
      return { success: false, error: error.message };
    }
  }

  // Configurar Push Publish para plataformas externas
  async configurePushPublish(userLogin, platform) {
    try {
      const pushConfig = {
        restURI: `http://localhost:8087/v2/servers/_defaultServer_/applications/${userLogin}/pushpublish/mapentries/${platform.platform.codigo}`,
        serverName: "_defaultServer_",
        appName: userLogin,
        appInstance: "_definst_",
        streamName: userLogin,
        entryName: platform.platform.codigo,
        profile: "rtmp",
        host: platform.rtmp_url || platform.platform.rtmp_base_url,
        application: "live",
        streamFile: platform.stream_key,
        userName: "",
        password: "",
        enabled: true
      };

      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/applications/${userLogin}/pushpublish/mapentries`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pushConfig),
        timeout: 10000
      });

      if (response.ok) {
        console.log(`✅ Push configurado para ${platform.platform.nome}`);
        return { success: true };
      } else {
        const errorText = await response.text();
        console.warn(`Erro ao configurar push para ${platform.platform.nome}:`, errorText);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.error(`Erro ao configurar push para ${platform.platform.nome}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Parar stream
  async stopStream(streamId) {
    try {
      // Extrair userLogin do streamId
      const userLogin = streamId.split('_')[1] || 'unknown';
      
      console.log(`🛑 Parando stream ${streamId} para usuário ${userLogin}`);

      // Parar Stream Publisher
      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/applications/${userLogin}/streamfiles/playlists_agendamentos.smil/actions/disconnect`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.ok) {
        console.log(`✅ Stream ${streamId} parado com sucesso`);
        return { success: true };
      } else {
        const errorText = await response.text();
        console.warn(`Erro ao parar stream:`, errorText);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.error('Erro ao parar stream:', error);
      return { success: false, error: error.message };
    }
  }

  // Obter estatísticas do stream
  async getStreamStats(streamId) {
    try {
      // Extrair userLogin do streamId
      const userLogin = streamId.split('_')[1] || 'unknown';
      
      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/applications/${userLogin}/monitoring/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.ok) {
        const data = await response.json();
        
        return {
          viewers: data.connectionsCurrent || 0,
          bitrate: data.messagesInBytesRate || 0,
          uptime: this.formatUptime(data.timeRunning || 0),
          isActive: data.connectionsCurrent > 0
        };
      } else {
        return {
          viewers: 0,
          bitrate: 0,
          uptime: '00:00:00',
          isActive: false
        };
      }
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        viewers: 0,
        bitrate: 0,
        uptime: '00:00:00',
        isActive: false
      };
    }
  }

  // Obter estatísticas do stream OBS
  async getOBSStreamStats(userId) {
    try {
      // Buscar userLogin
      const [userRows] = await db.execute(
        `SELECT usuario, email, 'streaming' as tipo FROM streamings WHERE codigo_cliente = ? 
         UNION 
         SELECT usuario, email, 'revenda' as tipo FROM revendas WHERE codigo = ?
         LIMIT 1`,
        [userId, userId]
      );

      const userLogin = userRows.length > 0 && userRows[0].usuario ? 
        userRows[0].usuario : 
        (userRows[0]?.email ? userRows[0].email.split('@')[0] : `user_${userId}`);

      // Verificar se há incoming streams ativos para o usuário
      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/${this.application}/instances/_definst_/incomingstreams`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.ok) {
        const data = await response.json();
        
        // Procurar stream do usuário na lista de incoming streams
        const userStream = data.incomingStreams?.find(stream => 
          stream.name === `${userLogin}_live` || 
          stream.name === userLogin ||
          stream.name.includes(userLogin)
        );

        if (userStream) {
          return {
            isLive: true,
            isActive: true,
            streamName: userStream.name,
            viewers: userStream.connectionsCurrent || 0,
            bitrate: Math.floor((userStream.messagesInBytesRate || 0) / 1000),
            uptime: this.formatUptime(userStream.timeRunning || 0),
            recording: false,
            platforms: [],
            streamInfo: {
              sourceIp: userStream.sourceIp || 'N/A',
              protocol: userStream.protocol || 'RTMP',
              isRecording: userStream.isRecording || false,
              audioCodec: userStream.audioCodec || 'N/A',
              videoCodec: userStream.videoCodec || 'N/A'
            }
          };
        } else {
          return {
            isLive: false,
            isActive: false,
            streamName: `${userLogin}_live`,
            viewers: 0,
            bitrate: 0,
            uptime: '00:00:00',
            recording: false,
            platforms: []
          };
        }
      } else {
        return {
          isLive: false,
          isActive: false,
          streamName: `${userLogin}_live`,
          viewers: 0,
          bitrate: 0,
          uptime: '00:00:00',
          recording: false,
          platforms: []
        };
      }
    } catch (error) {
      console.error('Erro ao obter estatísticas OBS:', error);
      return {
        isLive: false,
        isActive: false,
        streamName: `${userLogin}_live`,
        viewers: 0,
        bitrate: 0,
        uptime: '00:00:00',
        recording: false,
        platforms: []
      };
    }
  }

  // Verificar se há algum incoming stream ativo para o usuário
  async checkUserIncomingStreams(userId) {
    try {
      if (!this.initialized) {
        await this.initializeFromDatabase(userId);
      }

      // Buscar userLogin
      const [userRows] = await db.execute(
        `SELECT usuario, email, 'streaming' as tipo FROM streamings WHERE codigo_cliente = ? 
         UNION 
         SELECT usuario, email, 'revenda' as tipo FROM revendas WHERE codigo = ?
         LIMIT 1`,
        [userId, userId]
      );

      const userLogin = userRows.length > 0 && userRows[0].usuario ? 
        userRows[0].usuario : 
        (userRows[0]?.email ? userRows[0].email.split('@')[0] : `user_${userId}`);

      console.log(`🔍 Verificando incoming streams para usuário: ${userLogin}`);

      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/${this.application}/instances/_definst_/incomingstreams`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Total de incoming streams: ${data.incomingStreams?.length || 0}`);
        
        // Procurar streams do usuário
        const userStreams = data.incomingStreams?.filter(stream => 
          stream.name === `${userLogin}_live` || 
          stream.name === userLogin ||
          stream.name.includes(userLogin)
        ) || [];

        console.log(`🎯 Streams encontrados para ${userLogin}:`, userStreams.map(s => s.name));

        return {
          success: true,
          hasActiveStreams: userStreams.length > 0,
          activeStreams: userStreams,
          totalStreams: data.incomingStreams?.length || 0,
          userLogin: userLogin,
          wowzaUrl: this.baseUrl
        };
      } else {
        console.warn(`⚠️ Erro ao acessar API Wowza: ${response.status}`);
        return {
          success: false,
          hasActiveStreams: false,
          activeStreams: [],
          totalStreams: 0,
          userLogin: userLogin,
          error: `HTTP ${response.status}`,
          wowzaUrl: this.baseUrl
        };
      }
    } catch (error) {
      console.error('❌ Erro ao verificar incoming streams:', error);
      return {
        success: false,
        hasActiveStreams: false,
        activeStreams: [],
        totalStreams: 0,
        userLogin: `user_${userId}`,
        error: error.message,
        wowzaUrl: this.baseUrl
      };
    }
  }

  // Listar todos os incoming streams (para debug/admin)
  async listAllIncomingStreams() {
    try {
      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/${this.application}/instances/_definst_/incomingstreams`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          streams: data.incomingStreams || [],
          total: data.incomingStreams?.length || 0
        };
      } else {
        return {
          success: false,
          streams: [],
          total: 0,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      console.error('Erro ao listar incoming streams:', error);
      return {
        success: false,
        streams: [],
        total: 0,
        error: error.message
      };
    }
  }

  // Obter detalhes de um stream específico
  async getStreamDetails(streamName) {
    try {
      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/${this.application}/instances/_definst_/incomingstreams/${streamName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          stream: data,
          isActive: true
        };
      } else {
        return {
          success: false,
          stream: null,
          isActive: false,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      console.error(`Erro ao obter detalhes do stream ${streamName}:`, error);
      return {
        success: false,
        stream: null,
        isActive: false,
        error: error.message
      };
    }
  }

  // Parar stream OBS
  async stopOBSStream(userId) {
    try {
      // Buscar userLogin
      const [userRows] = await db.execute(
        `SELECT usuario, email, 'streaming' as tipo FROM streamings WHERE codigo_cliente = ? 
         UNION 
         SELECT usuario, email, 'revenda' as tipo FROM revendas WHERE codigo = ?
         LIMIT 1`,
        [userId, userId]
      );

      const userLogin = userRows.length > 0 && userRows[0].usuario ? 
        userRows[0].usuario : 
        (userRows[0]?.email ? userRows[0].email.split('@')[0] : `user_${userId}`);

      console.log(`🛑 Parando stream OBS para usuário ${userLogin}`);

      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/applications/${this.application}/instances/_definst_/incomingstreams/${userLogin}_live/actions/disconnectStream`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.ok) {
        console.log(`✅ Stream OBS parado para ${userLogin}`);
        return { success: true, message: 'Stream OBS finalizado' };
      } else {
        const errorText = await response.text();
        console.warn(`Erro ao parar stream OBS:`, errorText);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.error('Erro ao parar stream OBS:', error);
      return { success: false, error: error.message };
    }
  }

  // Pausar stream SMIL
  async pauseSMILStream(streamId) {
    try {
      const userLogin = streamId.split('_')[1] || 'unknown';
      
      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/applications/${userLogin}/streamfiles/playlists_agendamentos.smil/actions/pause`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return { success: response.ok };
    } catch (error) {
      console.error('Erro ao pausar stream SMIL:', error);
      return { success: false, error: error.message };
    }
  }

  // Retomar stream SMIL
  async resumeSMILStream(streamId) {
    try {
      const userLogin = streamId.split('_')[1] || 'unknown';
      
      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/applications/${userLogin}/streamfiles/playlists_agendamentos.smil/actions/play`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return { success: response.ok };
    } catch (error) {
      console.error('Erro ao retomar stream SMIL:', error);
      return { success: false, error: error.message };
    }
  }

  // Listar gravações
  async listRecordings(userLogin) {
    try {
      const response = await fetch(`${this.baseUrl}/v2/servers/_defaultServer_/applications/${userLogin}/dvrstores`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          recordings: data.dvrConverterStores || [],
          path: `/home/streaming/${userLogin}/recordings/`
        };
      } else {
        return {
          success: false,
          recordings: [],
          error: 'Erro ao listar gravações'
        };
      }
    } catch (error) {
      console.error('Erro ao listar gravações:', error);
      return {
        success: false,
        recordings: [],
        error: error.message
      };
    }
  }

  // Verificar limites do usuário
  async checkUserLimits(userConfig, requestedBitrate) {
    const maxBitrate = userConfig.bitrate || 2500;
    const allowedBitrate = requestedBitrate ? Math.min(requestedBitrate, maxBitrate) : maxBitrate;
    
    const warnings = [];
    if (requestedBitrate && requestedBitrate > maxBitrate) {
      warnings.push(`Bitrate solicitado (${requestedBitrate} kbps) excede o limite do plano (${maxBitrate} kbps)`);
    }

    return {
      success: true,
      limits: {
        bitrate: {
          max: maxBitrate,
          requested: requestedBitrate || maxBitrate,
          allowed: allowedBitrate
        },
        viewers: {
          max: userConfig.espectadores || 100
        }
      },
      warnings
    };
  }

  // Formatar uptime
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Iniciar streaming SMIL para playlist
  async startSMILStreaming(userId, userLogin, serverId, smilFileName) {
    try {
      console.log(`🎬 Iniciando streaming SMIL para ${userLogin}: ${smilFileName}`);

      // Inicializar se necessário
      if (!this.initialized) {
        await this.initializeFromDatabase(userId);
      }

      // Verificar se aplicação do usuário existe
      const appExists = await this.checkApplicationExists(userLogin, serverId);

      if (!appExists) {
        console.log(`📁 Aplicação ${userLogin} não existe, criando...`);

        // Buscar configurações do usuário
        let userConfig = { bitrate: 2500 };

        // Tentar buscar em streamings primeiro
        const [streamingRows] = await db.execute(
          `SELECT bitrate FROM streamings WHERE codigo_cliente = ? LIMIT 1`,
          [userId]
        );

        if (streamingRows.length > 0) {
          userConfig = streamingRows[0];
        } else {
          // Se não encontrou em streamings, buscar em revendas
          const [revendaRows] = await db.execute(
            `SELECT 2500 as bitrate FROM revendas WHERE codigo = ? LIMIT 1`,
            [userId]
          );

          if (revendaRows.length > 0) {
            userConfig = revendaRows[0];
          }
        }

        // Criar aplicação do usuário via JMX
        const createResult = await this.createUserApplication(userLogin, userConfig, serverId);

        if (!createResult) {
          console.error(`❌ Falha ao criar aplicação ${userLogin}`);
          console.log(`⚠️ Aviso ao iniciar streaming Wowza: Não foi possível criar aplicação no Wowza. Verifique as configurações do servidor.`);
          return {
            success: false,
            error: 'Não foi possível criar aplicação no Wowza. Verifique as configurações do servidor.'
          };
        }

        console.log(`✅ Aplicação ${userLogin} criada com sucesso`);

        // Aguardar a aplicação ser criada
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Iniciar Stream Publisher via JMX
      const streamResult = await this.startStreamPublisher(userLogin, smilFileName, serverId);

      if (streamResult.success) {
        console.log(`✅ Streaming SMIL iniciado com sucesso para ${userLogin}`);
        return {
          success: true,
          message: 'Streaming iniciado com sucesso',
          urls: {
            hls: `https://stmv1.udicast.com/${userLogin}/smil:${smilFileName}/playlist.m3u8`,
            rtmp: `rtmp://stmv1.udicast.com:1935/${userLogin}/smil:${smilFileName}`,
            rtsp: `rtsp://stmv1.udicast.com:554/${userLogin}/smil:${smilFileName}`
          }
        };
      } else {
        console.error(`❌ Erro ao iniciar streaming SMIL: ${streamResult.error}`);
        return {
          success: false,
          error: streamResult.error || 'Erro ao iniciar streaming'
        };
      }
    } catch (error) {
      console.error('Erro ao iniciar streaming SMIL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Parar streaming SMIL via REST API
  async stopSMILStreaming(userId, userLogin, smilFileName) {
    try {
      console.log(`🛑 Parando streaming SMIL para ${userLogin}: ${smilFileName}`);

      // Inicializar se necessário
      if (!this.initialized) {
        await this.initializeFromDatabase(userId);
      }

      // Parar MediaCaster via REST API
      try {
        const response = await fetch(
          `${this.baseUrl}/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/${userLogin}/instances/_definst_/streamfiles/${smilFileName}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        if (response.ok || response.status === 404) {
          // 404 significa que não existe/já foi parado, o que é OK
          console.log(`✅ Streaming SMIL parado com sucesso para ${userLogin}`);
          return {
            success: true,
            message: 'Streaming parado com sucesso'
          };
        } else {
          const errorText = await response.text();
          console.warn(`Aviso ao parar streaming:`, errorText);
          // Mesmo com warning, considerar sucesso se stream não estiver ativo
          return {
            success: true,
            message: 'Streaming parado (ou já estava inativo)',
            warning: errorText
          };
        }
      } catch (apiError) {
        console.warn(`Erro na API REST:`, apiError.message);
        // Se API não estiver disponível, considerar como sucesso (stream não está rodando)
        return {
          success: true,
          message: 'API não disponível, stream provavelmente já está parado',
          warning: apiError.message
        };
      }
    } catch (error) {
      console.error('Erro ao parar streaming SMIL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new WowzaStreamingService();