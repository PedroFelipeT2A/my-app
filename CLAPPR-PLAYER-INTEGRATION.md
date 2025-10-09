# Integração do Player Clappr para Transmissões

## O que foi implementado

Substituímos o sistema de IFrame player pelo **Clappr Player** em todas as telas de visualização de transmissão. O Clappr é um player brasileiro moderno, leve e otimizado para streams HLS (M3U8).

## Mudanças Realizadas

### 1. Dashboard (`src/pages/dashboard/Dashboard.tsx`)
- **Antes**: Usava `IFrameVideoPlayer` que carregava um iframe externo
- **Depois**: Usa `ClapprStreamingPlayer` que carrega diretamente a URL M3U8
- **URL de Stream**: `https://stmv1.udicast.com/{userLogin}/{userLogin}/playlist.m3u8`

### 2. Playlists (`src/pages/dashboard/Playlists.tsx`)
- **Antes**: Usava `StreamingPlayerManager` com iframe interno
- **Depois**: Usa `ClapprStreamingPlayer` diretamente
- **URL de Stream**: `https://stmv1.udicast.com/{userLogin}/{userLogin}/playlist.m3u8`

### 3. Streaming Player Manager (`src/components/players/StreamingPlayerManager.tsx`)
- **Antes**: Renderizava `IFrameVideoPlayer`
- **Depois**: Renderiza `ClapprStreamingPlayer`
- Detecta automaticamente streams de playlist e OBS

## Vantagens do Clappr

1. **Performance**: Player leve e otimizado
2. **HLS Nativo**: Suporte completo a streams M3U8
3. **Baixa Latência**: Configurado para streams ao vivo com buffer reduzido
4. **Auto-reconexão**: Reconecta automaticamente se o stream cair
5. **Estatísticas em Tempo Real**: Exibe espectadores, bitrate e uptime
6. **Mobile-Friendly**: Funciona perfeitamente em dispositivos móveis

## Configurações do Clappr

O player está configurado com:
- **autoPlay**: `true` para transmissões ao vivo
- **controls**: `true` para controles nativos
- **lowLatencyMode**: `true` para reduzir latência
- **backBufferLength**: 10 segundos (ao vivo) / 30 segundos (VOD)
- **maxBufferLength**: 20 segundos (ao vivo) / 60 segundos (VOD)
- **liveSyncDurationCount**: 3 chunks para sincronização

## Exemplo de Uso

```tsx
<ClapprStreamingPlayer
  src="https://stmv1.udicast.com/pedrowcore/pedrowcore/playlist.m3u8"
  title="Minha Transmissão"
  isLive={true}
  autoplay={true}
  controls={true}
  streamStats={{
    viewers: 10,
    bitrate: 2500,
    uptime: '01:23:45',
    quality: '1080p'
  }}
  onReady={() => console.log('Player pronto')}
  onError={(error) => console.error('Erro:', error)}
/>
```

## Testando no Celular

Para testar a transmissão diretamente no celular:

1. Abra o navegador (Chrome, Safari, etc.)
2. Digite a URL: `https://stmv1.udicast.com/pedrowcore/pedrowcore/playlist.m3u8`
3. O navegador deve abrir o player nativo automaticamente

Ou use o dashboard/playlists que agora carregam o Clappr automaticamente!

## URLs de Stream

### Playlist/Agendamento
```
https://stmv1.udicast.com/{userLogin}/{userLogin}/playlist.m3u8
```

### OBS Live
```
https://stmv1.udicast.com/{userLogin}/{userLogin}_live/playlist.m3u8
```

## Troubleshooting

### Stream não carrega
- Verifique se há transmissão ativa
- Confirme que a URL M3U8 está acessível
- Verifique o console do navegador para erros

### Erro 404
- Stream offline ou não iniciado
- Aguarde alguns segundos e clique em "Reconectar"

### Latência alta
- Normal em HLS (10-30 segundos)
- Para latência ultra-baixa, considere WebRTC

## Arquivos Modificados

1. `src/pages/dashboard/Dashboard.tsx`
2. `src/pages/dashboard/Playlists.tsx`
3. `src/components/players/StreamingPlayerManager.tsx`

## Componente Clappr

O componente `ClapprStreamingPlayer` já estava implementado em:
- `src/components/players/ClapprStreamingPlayer.tsx`

Agora está sendo usado em todas as telas de visualização!
