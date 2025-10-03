import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import IFrameVideoPlayer from './IFrameVideoPlayer';
import { Play, Settings, Eye, Share2, Download, Zap, Monitor, Activity, Radio, Wifi, WifiOff, AlertCircle, CheckCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface StreamingPlayerManagerProps {
  className?: string;
  showPlayerSelector?: boolean;
  enableSocialSharing?: boolean;
  enableViewerCounter?: boolean;
  enableWatermark?: boolean;
  autoDetectStream?: boolean;
}

interface StreamStatus {
  is_live: boolean;
  stream_type?: 'playlist' | 'obs';
  transmission?: {
    id: number;
    titulo: string;
    codigo_playlist: number;
    playlist_nome?: string;
    stats: {
      viewers: number;
      bitrate: number;
      uptime: string;
      isActive: boolean;
    };
  };
  obs_stream?: {
    is_live: boolean;
    viewers: number;
    bitrate: number;
    uptime: string;
    recording: boolean;
    streamName?: string;
  };
}

interface Logo {
  id: number;
  nome: string;
  url: string;
}

interface WatermarkConfig {
  enabled: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;
  logo_url: string;
}

const StreamingPlayerManager: React.FC<StreamingPlayerManagerProps> = ({
  className = '',
  showPlayerSelector = true,
  enableSocialSharing = true,
  enableViewerCounter = true,
  enableWatermark = true,
  autoDetectStream = true
}) => {
  const { user, getToken } = useAuth();
  const [selectedPlayer, setSelectedPlayer] = useState('videojs');
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string>('');
  const [streamTitle, setStreamTitle] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [logos, setLogos] = useState<Logo[]>([]);
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
    enabled: enableWatermark,
    position: 'bottom-right',
    opacity: 80,
    logo_url: ''
  });
  const [lastStreamCheck, setLastStreamCheck] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [noSignal, setNoSignal] = useState(false);

  const userLogin = user?.usuario || (user?.email ? user.email.split('@')[0] : `user_${user?.id || 'usuario'}`);

  useEffect(() => {
    if (autoDetectStream) {
      loadStreamStatus();
      loadLogos();
      
      // Atualizar status a cada 30 segundos
      const interval = setInterval(loadStreamStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [autoDetectStream]);

  const loadStreamStatus = async () => {
    try {
      setConnectionError(null);
      const token = await getToken();
      const response = await fetch('/api/streaming/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStreamStatus(data);
        setLastStreamCheck(Date.now());
        
        // Construir URL do stream baseado no status seguindo lógica do PHP
        if (data.is_live) {
          let streamUrl = '';
          let title = '';
          
          if (data.stream_type === 'playlist' && data.transmission) {
            // Para playlist, usar SMIL conforme PHP: smil:transcoder.smil ou smil:playlists_agendamentos.smil
            streamUrl = `https://stmv1.udicast.com/${userLogin}/${userLogin}/playlist.m3u8`;
            title = `📺 Playlist: ${data.transmission.playlist_nome || data.transmission.titulo}`;
            console.log('🎵 Stream de playlist detectado:', streamUrl);
          } else if (data.stream_type === 'obs' && data.obs_stream?.is_live) {
            // Para OBS, usar formato padrão: servidor/login/login/playlist.m3u8
            streamUrl = `https://stmv1.udicast.com/${userLogin}/${userLogin}_live/playlist.m3u8`;
            title = `📡 OBS: ${data.obs_stream.streamName || `${userLogin}_live`}`;
            console.log('📡 Stream OBS detectado:', streamUrl);
          }
          
          // Verificar se stream está realmente funcionando (como no PHP)
          if (streamUrl) {
            const isStreamActive = await checkStreamAvailability(streamUrl);
            if (isStreamActive) {
              setCurrentStreamUrl(streamUrl);
              setStreamTitle(title);
              setNoSignal(false);
            } else {
              console.log('⚠️ Stream URL não está acessível:', streamUrl);
              setNoSignal(true);
              setCurrentStreamUrl('');
              setStreamTitle('');
            }
          }
        } else {
          // Sem transmissão ativa
          setCurrentStreamUrl('');
          setStreamTitle('');
          setNoSignal(false);
          console.log('📴 Nenhuma transmissão ativa detectada');
          
          // Limpar transmissões inativas
          await cleanupInactiveTransmissions();
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Erro ao verificar status de transmissão:', error);
      setConnectionError(error instanceof Error ? error.message : 'Erro de conexão');
      setStreamStatus(null);
      setCurrentStreamUrl('');
      setStreamTitle('');
      setNoSignal(false);
    }
  };

  // Verificar se stream está disponível (equivalente ao get_headers do PHP)
  const checkStreamAvailability = async (streamUrl: string): Promise<boolean> => {
    try {
      const response = await fetch(streamUrl, { 
        method: 'HEAD',
        mode: 'no-cors' // Para evitar problemas de CORS
      });
      return true; // Se chegou até aqui, stream existe
    } catch (error) {
      console.warn('Stream não acessível via HEAD request, tentando GET:', error);
      
      // Fallback: tentar GET request
      try {
        const response = await fetch(streamUrl, {
          method: 'GET',
          mode: 'no-cors'
        });
        return true;
      } catch (getError) {
        console.warn('Stream não acessível:', getError);
        return false;
      }
    }
  };

  const cleanupInactiveTransmissions = async () => {
    try {
      const token = await getToken();
      
      const cleanupResponse = await fetch('/api/streaming/cleanup-inactive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      
      if (cleanupResponse.ok) {
        const result = await cleanupResponse.json();
        if (result.cleaned_count > 0) {
          console.log(`🧹 Limpeza automática: ${result.cleaned_count} transmissões inativas finalizadas`);
        }
      }
    } catch (error) {
      console.warn('Erro na limpeza automática:', error);
    }
  };

  const loadLogos = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/logos', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setLogos(data);

      if (data.length > 0 && !watermarkConfig.logo_url) {
        setWatermarkConfig(prev => ({
          ...prev,
          logo_url: data[0].url
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar logos:', error);
    }
  };

  const buildStreamUrl = (baseUrl: string, vod?: string) => {
    // Seguir lógica do PHP para construir URLs
    const servidor = 'stmv1.udicast.com';
    
    if (vod) {
      // VOD específico: https://servidor/login/login/mp4:vod/playlist.m3u8
      return `https://${servidor}/${userLogin}/${userLogin}/mp4:${vod}/playlist.m3u8`;
    } else if (streamStatus?.stream_type === 'playlist') {
      // Playlist com SMIL: https://servidor/login/smil:playlists_agendamentos.smil/playlist.m3u8
      return `https://${servidor}/${userLogin}/smil:playlists_agendamentos.smil/playlist.m3u8`;
    } else {
      // Stream padrão: https://servidor/login/login/playlist.m3u8
      return `https://${servidor}/${userLogin}/${userLogin}/playlist.m3u8`;
    }
  };

  const generatePlayerCode = () => {
    const streamUrl = currentStreamUrl || buildStreamUrl('', undefined);
    const aspectRatio = '16:9';
    const contador = enableViewerCounter ? 'sim' : 'nao';
    const compartilhamento = enableSocialSharing ? 'sim' : 'nao';
    
    // Construir URL do player seguindo padrão do sistema
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'http://samhost.wcore.com.br:3001'
      : 'http://localhost:3001';
    
    const playerUrl = `${baseUrl}/api/player-port/iframe?login=${userLogin}&player=${selectedPlayer}&aspectratio=${aspectRatio}&contador=${contador}&compartilhamento=${compartilhamento}`;
    
    switch (selectedPlayer) {
      case 'videojs':
        return `<!-- Player Video.js Otimizado -->
<iframe 
  src="${playerUrl}" 
  width="640" 
  height="360" 
  frameborder="0" 
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture">
</iframe>

<!-- URL HLS Direta -->
<!-- ${streamUrl} -->`;

      case 'clappr':
        return `<!-- Player Clappr -->
<iframe 
  src="${playerUrl}&player_type=clappr" 
  width="640" 
  height="360" 
  frameborder="0" 
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture">
</iframe>

<!-- URL HLS Direta -->
<!-- ${streamUrl} -->`;

      case 'html5':
        return `<!-- Player HTML5 Nativo -->
<video width="640" height="360" controls autoplay muted>
  <source src="${streamUrl}" type="application/vnd.apple.mpegurl">
  <source src="${streamUrl}" type="video/mp4">
  Seu navegador não suporta vídeo HTML5.
</video>

<!-- URL HLS -->
<!-- ${streamUrl} -->`;

      default:
        return `<!-- Player iFrame Universal -->
<iframe 
  src="${playerUrl}" 
  width="640" 
  height="360" 
  frameborder="0" 
  allowfullscreen
  allow="autoplay; fullscreen; picture-in-picture">
</iframe>`;
    }
  };

  const copyPlayerCode = () => {
    const code = generatePlayerCode();
    navigator.clipboard.writeText(code);
    toast.success('Código do player copiado!');
  };

  const renderPlayer = () => {
    if (noSignal) {
      // Tela de "sem sinal" como no PHP
      return (
        <div className="w-full h-full flex items-center justify-center text-white bg-black">
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block">
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-8 bg-gray-600 animate-pulse"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">SEM SINAL</h2>
            <p className="text-gray-400 mb-4">No Signal</p>
            <p className="text-sm text-gray-500">
              Usuário: {userLogin}
            </p>
            <p className="text-xs text-gray-600 mt-4">
              Recarregando automaticamente em 10 segundos...
            </p>
          </div>
        </div>
      );
    }

    if (currentStreamUrl) {
      // Construir URL do player na porta do sistema
      const baseUrl = window.location.protocol === 'https:' 
        ? `https://${window.location.hostname}:3001`
        : `http://${window.location.hostname}:3001`;
      
      const contador = enableViewerCounter ? 'true' : 'false';
      const compartilhamento = enableSocialSharing ? 'true' : 'false';
      
      const iframeUrl = `${baseUrl}/api/player-port/iframe?login=${userLogin}&player=1&contador=${contador}&compartilhamento=${compartilhamento}&aspectratio=16:9`;
      
      return (
        <IFrameVideoPlayer
          src={iframeUrl}
          title={streamTitle}
          isLive={streamStatus?.is_live || false}
          autoplay={false}
          controls={true}
          className="w-full h-full"
          streamStats={streamStatus?.is_live ? {
            viewers: streamStatus.transmission?.stats.viewers || streamStatus.obs_stream?.viewers || 0,
            bitrate: streamStatus.transmission?.stats.bitrate || streamStatus.obs_stream?.bitrate || 0,
            uptime: streamStatus.transmission?.stats.uptime || streamStatus.obs_stream?.uptime || '00:00:00',
            quality: '1080p',
            isRecording: streamStatus.obs_stream?.recording || false
          } : undefined}
          onReady={() => console.log('Player pronto para transmissão')}
          onError={(error: any) => {
            console.error('Erro no player:', error);
            setNoSignal(true);
            // Auto-reload após 10 segundos como no PHP
            setTimeout(() => {
              loadStreamStatus();
            }, 10000);
          }}
        />
      );
    }
    
    return (
      <div className="w-full h-full flex items-center justify-center text-white">
        <div className="text-center">
          <WifiOff className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold mb-2">Nenhuma Transmissão Ativa</h3>
          <p className="text-gray-400 mb-4">
            {connectionError ? 'Erro de conexão com o servidor' : 'Inicie uma transmissão para visualizar aqui'}
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>Domínio: stmv1.udicast.com</p>
            <p>Usuário: {userLogin}</p>
            <p>Verificando streams automaticamente...</p>
          </div>
        </div>
      </div>
    );
  };

  const getStreamStatusInfo = () => {
    if (noSignal) {
      return {
        status: 'Sem Sinal',
        color: 'text-red-600',
        icon: <WifiOff className="h-4 w-4" />
      };
    }

    if (connectionError) {
      return {
        status: 'Erro de Conexão',
        color: 'text-red-600',
        icon: <WifiOff className="h-4 w-4" />
      };
    }

    if (!streamStatus) {
      return {
        status: 'Verificando...',
        color: 'text-gray-600',
        icon: <Activity className="h-4 w-4 animate-pulse" />
      };
    }

    if (streamStatus.is_live) {
      if (streamStatus.stream_type === 'playlist') {
        return {
          status: 'Playlist ao Vivo',
          color: 'text-blue-600',
          icon: <Radio className="h-4 w-4" />
        };
      } else if (streamStatus.stream_type === 'obs') {
        return {
          status: 'OBS ao Vivo',
          color: 'text-red-600',
          icon: <Wifi className="h-4 w-4" />
        };
      }
      return {
        status: 'Ao Vivo',
        color: 'text-green-600',
        icon: <Wifi className="h-4 w-4" />
      };
    }

    return {
      status: 'Offline',
      color: 'text-gray-600',
      icon: <WifiOff className="h-4 w-4" />
    };
  };

  const statusInfo = getStreamStatusInfo();

  // Auto-reload quando há "sem sinal" (como no PHP)
  useEffect(() => {
    if (noSignal) {
      const timeout = setTimeout(() => {
        console.log('🔄 Auto-reload devido a sem sinal...');
        loadStreamStatus();
        setNoSignal(false);
      }, 10000); // 10 segundos como no PHP

      return () => clearTimeout(timeout);
    }
  }, [noSignal]);

  return (
    <div className={`streaming-player-manager space-y-6 ${className}`}>
      {/* Header com Status */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Player de Transmissão</h2>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${statusInfo.color}`}>
              {statusInfo.icon}
              <span className="font-medium">{statusInfo.status}</span>
            </div>
            <button
              onClick={loadStreamStatus}
              disabled={loading}
              className="text-primary-600 hover:text-primary-800 flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Informações do Stream Ativo */}
        {streamStatus?.is_live && currentStreamUrl && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-green-800">
                  {streamStatus.stream_type === 'playlist' ? '📺 Transmissão de Playlist (SMIL)' : '📡 Transmissão OBS'}
                </h3>
                <p className="text-green-700 text-sm">
                  {streamTitle}
                </p>
                <p className="text-green-600 text-xs mt-1 font-mono">
                  {currentStreamUrl}
                </p>
              </div>
              <div className="text-right text-sm text-green-700">
                <div>👥 {streamStatus.transmission?.stats.viewers || streamStatus.obs_stream?.viewers || 0} espectadores</div>
                <div>⚡ {streamStatus.transmission?.stats.bitrate || streamStatus.obs_stream?.bitrate || 0} kbps</div>
                <div>⏱️ {streamStatus.transmission?.stats.uptime || streamStatus.obs_stream?.uptime || '00:00:00'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Aviso de Sem Sinal */}
        {noSignal && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
              <div>
                <h3 className="font-medium text-red-800">Stream Offline</h3>
                <p className="text-red-700 text-sm">
                  O stream não está acessível no momento. Verificando automaticamente...
                </p>
                <p className="text-red-600 text-xs mt-1 font-mono">
                  URL testada: {buildStreamUrl('')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Erro de Conexão */}
        {connectionError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
              <div>
                <h3 className="font-medium text-red-800">Erro de Conexão</h3>
                <p className="text-red-700 text-sm">{connectionError}</p>
                <p className="text-red-600 text-xs mt-1">
                  Última verificação: {lastStreamCheck ? new Date(lastStreamCheck).toLocaleTimeString() : 'Nunca'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Configurações de Watermark */}
        {enableWatermark && logos.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Marca d'água</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={watermarkConfig.enabled}
                    onChange={(e) => setWatermarkConfig(prev => ({ 
                      ...prev, 
                      enabled: e.target.checked 
                    }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Exibir marca d'água</span>
                </label>
              </div>

              {watermarkConfig.enabled && (
                <>
                  <div>
                    <select
                      value={watermarkConfig.logo_url}
                      onChange={(e) => setWatermarkConfig(prev => ({ 
                        ...prev, 
                        logo_url: e.target.value 
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Selecionar logo</option>
                      {logos.map((logo) => (
                        <option key={logo.id} value={logo.url}>
                          {logo.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={watermarkConfig.position}
                      onChange={(e) => setWatermarkConfig(prev => ({ 
                        ...prev, 
                        position: e.target.value as any 
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="top-left">Superior Esquerda</option>
                      <option value="top-right">Superior Direita</option>
                      <option value="bottom-left">Inferior Esquerda</option>
                      <option value="bottom-right">Inferior Direita</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">
                      Opacidade: {watermarkConfig.opacity}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={watermarkConfig.opacity}
                      onChange={(e) => setWatermarkConfig(prev => ({ 
                        ...prev, 
                        opacity: parseInt(e.target.value) 
                      }))}
                      className="w-full mt-1"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Player Principal */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Player de Transmissão</h3>
          <div className="flex items-center space-x-2">
            {streamStatus?.is_live && !noSignal ? (
              <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-700">AO VIVO</span>
              </div>
            ) : noSignal ? (
              <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-red-700">SEM SINAL</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600">OFFLINE</span>
              </div>
            )}
            
            {currentStreamUrl && (
              <button
                onClick={() => window.open(currentStreamUrl, '_blank')}
                className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir Stream
              </button>
            )}
          </div>
        </div>

        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
          {renderPlayer()}
        </div>

        {/* Informações do Stream */}
        {currentStreamUrl && !noSignal && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">Informações do Stream</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">URL HLS:</span>
                <div className="font-mono text-xs bg-white p-2 rounded border mt-1 break-all">
                  {currentStreamUrl}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Domínio:</span>
                <span className="ml-2 font-medium font-mono">stmv1.udicast.com</span>
              </div>
              <div>
                <span className="text-gray-600">Tipo:</span>
                <span className="ml-2 font-medium">
                  {streamStatus?.stream_type === 'playlist' ? 'Playlist SMIL' : 
                   streamStatus?.stream_type === 'obs' ? 'OBS Live' : 'Stream'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Aplicação:</span>
                <span className="ml-2 font-medium">{userLogin}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Código de Incorporação */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Código de Incorporação</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Código {selectedPlayer.toUpperCase()}
              </span>
              <button
                onClick={copyPlayerCode}
                className="text-primary-600 hover:text-primary-800 text-sm"
              >
                Copiar
              </button>
            </div>
            <pre className="bg-gray-50 p-3 rounded-md text-sm overflow-x-auto">
              <code>{generatePlayerCode()}</code>
            </pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">URLs de Streaming:</span>
              <ul className="text-gray-600 mt-1 space-y-1">
                <li>• <strong>HLS Playlist:</strong> https://stmv1.udicast.com/{userLogin}/smil:playlists_agendamentos.smil/playlist.m3u8</li>
                <li>• <strong>HLS OBS:</strong> https://stmv1.udicast.com/{userLogin}/{userLogin}/playlist.m3u8</li>
                <li>• <strong>RTMP:</strong> rtmp://stmv1.udicast.com:1935/{userLogin}</li>
              </ul>
            </div>
            
            <div>
              <span className="font-medium text-gray-700">Configurações Ativas:</span>
              <ul className="text-gray-600 mt-1 space-y-1">
                <li>• <strong>Domínio:</strong> stmv1.udicast.com</li>
                <li>• <strong>Usuário:</strong> {userLogin}</li>
                <li>• <strong>Contador:</strong> {enableViewerCounter ? 'Ativo' : 'Inativo'}</li>
                <li>• <strong>Compartilhamento:</strong> {enableSocialSharing ? 'Ativo' : 'Inativo'}</li>
                <li>• <strong>Watermark:</strong> {watermarkConfig.enabled ? 'Ativo' : 'Inativo'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Instruções de Uso */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <CheckCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-blue-900 font-medium mb-2">🎥 Sistema de Transmissão Atualizado</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• <strong>Domínio Oficial:</strong> stmv1.udicast.com (seguindo padrão de referência)</li>
              <li>• <strong>Detecção Automática:</strong> Verifica se stream está realmente funcionando</li>
              <li>• <strong>Sem Sinal:</strong> Mostra tela de "sem sinal" quando stream está offline</li>
              <li>• <strong>Auto-reload:</strong> Recarrega automaticamente a cada 10 segundos quando offline</li>
              <li>• <strong>Playlist SMIL:</strong> Usa smil:playlists_agendamentos.smil para playlists</li>
              <li>• <strong>OBS Live:</strong> Usa formato padrão login/login/playlist.m3u8</li>
              <li>• <strong>Verificação de Headers:</strong> Testa se URL está acessível antes de exibir</li>
              <li>• <strong>Compatibilidade Total:</strong> Funciona em todos os dispositivos</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status de Conexão Detalhado */}
      {!streamStatus?.is_live && !connectionError && !noSignal && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-yellow-900 font-medium mb-2">📡 Aguardando Transmissão</h3>
              <p className="text-yellow-800 text-sm mb-3">
                Para visualizar conteúdo no player, você precisa:
              </p>
              <ul className="text-yellow-800 text-sm space-y-1">
                <li>• <strong>Iniciar uma Playlist:</strong> Vá em "Playlists" e clique em "Transmitir Playlist"</li>
                <li>• <strong>Transmitir via OBS:</strong> Configure OBS com RTMP: rtmp://stmv1.udicast.com:1935/{userLogin}</li>
                <li>• <strong>Stream Key:</strong> {userLogin}_live</li>
                <li>• <strong>Usar Relay RTMP:</strong> Configure um relay 24/7 em "Relay RTMP"</li>
              </ul>
              <div className="mt-3 p-2 bg-yellow-100 rounded text-xs">
                <p><strong>URLs de teste:</strong></p>
                <p>• Playlist: https://stmv1.udicast.com/{userLogin}/smil:playlists_agendamentos.smil/playlist.m3u8</p>
                <p>• OBS: https://stmv1.udicast.com/{userLogin}/{userLogin}/playlist.m3u8</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamingPlayerManager;