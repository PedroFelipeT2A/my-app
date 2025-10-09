# Guia de Transmissão de Playlists

## Visão Geral

Este sistema permite iniciar transmissões automáticas de playlists no Wowza Media Server usando arquivos SMIL e JMXCommandLine.

## Como Funciona

### 1. Estrutura de Arquivos

- **Arquivo SMIL**: `/home/streaming/{usuario}/playlists_agendamentos.smil`
  - Contém a lista de vídeos da playlist em formato XML
  - É gerado automaticamente pelo sistema
  - Segue o formato do Wowza Media Server

### 2. Fluxo de Transmissão

```
Usuário seleciona playlist no painel
    ↓
Sistema gera arquivo SMIL no servidor
    ↓
Aplicação Wowza é iniciada via JMX
    ↓
Transmissão começa automaticamente
    ↓
Stream disponível em: https://stmv1.udicast.com:1935/{usuario}/{usuario}/playlist.m3u8
```

## Endpoints da API

### Iniciar Transmissão de Playlist

**POST** `/api/streaming/start`

**Body:**
```json
{
  "titulo": "Minha Transmissão",
  "descricao": "Descrição da transmissão",
  "playlist_id": 123,
  "platform_ids": [],
  "enable_recording": false,
  "use_smil": true,
  "loop_playlist": true
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "transmission_id": 456,
  "message": "Transmissão da playlist \"Minha Playlist\" iniciada com sucesso",
  "playlist_name": "Minha Playlist",
  "videos_count": 10,
  "player_urls": {
    "iframe": "https://samhost.wcore.com.br:3001/api/player-port/iframe?login=usuario&playlist=123...",
    "direct_hls": "https://stmv1.udicast.com:1935/usuario/smil:playlists_agendamentos.smil/playlist.m3u8",
    "direct_rtmp": "rtmp://stmv1.udicast.com:1935/usuario/smil:playlists_agendamentos.smil",
    "wowza_url": "https://stmv1.udicast.com:1935/usuario/usuario/playlist.m3u8"
  },
  "streaming_info": {
    "server": "stmv1.udicast.com",
    "user_login": "usuario",
    "smil_file": "playlists_agendamentos.smil",
    "status": "Transmitindo"
  },
  "instructions": {
    "access": "Acesse a transmissão em: https://stmv1.udicast.com:1935/usuario/smil:playlists_agendamentos.smil/playlist.m3u8",
    "player": "Use a URL do iframe para incorporar o player em seu site",
    "obs": "A transmissão está ativa e pode ser acessada pelos links acima"
  }
}
```

### Parar Transmissão

**POST** `/api/streaming/stop`

**Body:**
```json
{
  "transmission_id": 456,
  "stream_type": "playlist"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Transmissão finalizada com sucesso"
}
```

### Verificar Status da Transmissão

**GET** `/api/streaming/status`

**Resposta:**
```json
{
  "is_live": true,
  "stream_type": "playlist",
  "transmission": {
    "id": 456,
    "titulo": "Minha Transmissão",
    "codigo_playlist": 123,
    "stats": {
      "viewers": 0,
      "bitrate": 0,
      "uptime": "00:00:00",
      "isActive": true
    },
    "platforms": []
  }
}
```

## Componentes do Sistema

### Backend

1. **PlaylistSMILService** (`backend/services/PlaylistSMILService.js`)
   - Gera arquivos SMIL a partir das playlists
   - Envia arquivos para o servidor via SSH
   - Valida estrutura de diretórios

2. **StreamingControlService** (`backend/services/StreamingControlService.js`)
   - Controla aplicações Wowza via JMX
   - Inicia/para/reinicia aplicações
   - Verifica status das aplicações

3. **Routes** (`backend/routes/streaming-control.js`)
   - `/api/streaming/start` - Inicia transmissão de playlist
   - `/api/streaming/stop` - Para transmissão
   - `/api/streaming/status` - Status da transmissão

### Como o JMX Funciona

O sistema usa JMXCommandLine para controlar o Wowza:

```bash
# Comando base
/usr/bin/java -cp /usr/local/WowzaMediaServer JMXCommandLine \
  -jmx service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi \
  -user admin -pass admin

# Verificar se aplicação está rodando
{jmxCommand} getApplicationInstanceInfo {usuario}

# Iniciar aplicação
{jmxCommand} startAppInstance {usuario}

# Parar aplicação
{jmxCommand} shutdownAppInstance {usuario}
```

## Formato do Arquivo SMIL

```xml
<?xml version="1.0" encoding="UTF-8"?>
<smil title="usuario">
<head></head>
<body>
<stream name="usuario"></stream>

<playlist name="minhaplaylist" playOnStream="usuario" repeat="true" scheduled="2024-01-01 00:00:00">
<video length="120" src="mp4:pasta/video1.mp4" start="0"></video>
<video length="180" src="mp4:pasta/video2.mp4" start="0"></video>
<video length="90" src="mp4:pasta/video3.mp4" start="0"></video>
</playlist>

</body>
</smil>
```

### Atributos Importantes

- `playOnStream`: Nome da aplicação Wowza (geralmente o login do usuário)
- `repeat`: Se deve repetir a playlist (true/false)
- `scheduled`: Data/hora de início (pode ser passada para começar imediatamente)
- `src`: Caminho do vídeo relativo ao diretório do usuário (formato: `mp4:pasta/arquivo.mp4`)

## URLs de Acesso à Transmissão

Após iniciar a transmissão, ela estará disponível em:

### HLS (Recomendado)
```
https://stmv1.udicast.com:1935/{usuario}/smil:playlists_agendamentos.smil/playlist.m3u8
```

### RTMP
```
rtmp://stmv1.udicast.com:1935/{usuario}/smil:playlists_agendamentos.smil
```

### RTSP
```
rtsp://stmv1.udicast.com:554/{usuario}/smil:playlists_agendamentos.smil
```

### DASH
```
http://stmv1.udicast.com:1935/{usuario}/smil:playlists_agendamentos.smil/manifest.mpd
```

## Resolução de Problemas

### A transmissão não inicia

1. **Verificar se a aplicação Wowza está rodando:**
   ```bash
   /usr/bin/java -cp /usr/local/WowzaMediaServer JMXCommandLine \
     -jmx service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi \
     -user admin -pass admin \
     getApplicationInstanceInfo {usuario}
   ```

2. **Verificar se o arquivo SMIL existe:**
   ```bash
   ls -la /home/streaming/{usuario}/playlists_agendamentos.smil
   ```

3. **Verificar logs do Wowza:**
   ```bash
   tail -f /usr/local/WowzaStreamingEngine/logs/wowzastreamingengine_access.log
   ```

### A transmissão não aparece na URL

1. **Aguardar alguns segundos** - O Wowza pode levar até 5 segundos para processar o arquivo SMIL

2. **Verificar permissões do arquivo:**
   ```bash
   chmod 644 /home/streaming/{usuario}/playlists_agendamentos.smil
   chown streaming:streaming /home/streaming/{usuario}/playlists_agendamentos.smil
   ```

3. **Reiniciar a aplicação Wowza:**
   ```bash
   {jmxCommand} shutdownAppInstance {usuario}
   sleep 2
   {jmxCommand} startAppInstance {usuario}
   ```

### Vídeos não são encontrados

1. **Verificar caminhos dos vídeos no SMIL** - Devem ser relativos ao diretório `/home/streaming/{usuario}/`

2. **Exemplo correto:**
   - Caminho do arquivo: `/home/streaming/usuario/pasta/video.mp4`
   - No SMIL: `<video src="mp4:pasta/video.mp4" />`

3. **Verificar se vídeos existem:**
   ```bash
   ls -la /home/streaming/{usuario}/pasta/
   ```

## Integração com Frontend

O frontend pode usar os endpoints da API para:

1. **Listar playlists disponíveis** - `GET /api/playlists`
2. **Iniciar transmissão** - `POST /api/streaming/start`
3. **Verificar status** - `GET /api/streaming/status`
4. **Parar transmissão** - `POST /api/streaming/stop`

### Exemplo de Uso no React

```javascript
// Iniciar transmissão
const startPlaylist = async (playlistId) => {
  const response = await api.post('/streaming/start', {
    titulo: 'Minha Transmissão',
    playlist_id: playlistId,
    use_smil: true,
    loop_playlist: true
  });

  if (response.data.success) {
    console.log('URLs:', response.data.player_urls);
    // Redirecionar para página de player ou mostrar URLs
  }
};

// Verificar status
const checkStatus = async () => {
  const response = await api.get('/streaming/status');
  if (response.data.is_live) {
    console.log('Transmissão ativa:', response.data.transmission);
  }
};

// Parar transmissão
const stopTransmission = async (transmissionId) => {
  const response = await api.post('/streaming/stop', {
    transmission_id: transmissionId
  });

  if (response.data.success) {
    console.log('Transmissão finalizada');
  }
};
```

## Considerações de Performance

1. **Aplicações Wowza ficam rodando** - Após iniciar, a aplicação continua rodando mesmo após parar a transmissão, economizando tempo na próxima transmissão

2. **Arquivo SMIL é reutilizado** - O mesmo arquivo `playlists_agendamentos.smil` é usado para todas as transmissões do usuário

3. **Múltiplas playlists** - Para transmitir outra playlist, basta gerar um novo SMIL e a aplicação Wowza vai automaticamente mudar para a nova fonte

## Segurança

1. **Autenticação obrigatória** - Todos os endpoints requerem autenticação JWT
2. **Validação de propriedade** - Sistema verifica se playlist pertence ao usuário
3. **Isolamento de recursos** - Cada usuário tem sua própria aplicação Wowza e diretório

## Próximos Passos

- [ ] Adicionar suporte a múltiplas playlists simultâneas
- [ ] Implementar agendamento de playlists
- [ ] Adicionar estatísticas de visualização em tempo real
- [ ] Suporte a comerciais intercalados na playlist
- [ ] Gravação automática das transmissões
