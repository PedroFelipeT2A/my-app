import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ClapprStreamingPlayer from './ClapprStreamingPlayer';
import { Play, Settings, Eye, Share2, Download, Zap, Monitor, Activity, Radio, Wifi, WifiOff, AlertCircle, CheckCircle, RefreshCw, ExternalLink } from 'lucide-react';

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
  const [selectedLogo, setSelectedLogo] = useState<string>('');
  const [watermarkConfig, setWatermarkConfig] = useState({
    enabled: enableWatermark,
    position: 'bottom-right' as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
    opacity: 50
  });
  const [lastStreamCheck, setLastStreamCheck] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

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
        
        // Construir URL do stream baseado no status
        if (data.is_live) {
          if (data.stream_type === 'playlist' && data.transmission) {
            // Stream de playlist usando SMIL
            const smilUrl = `https://stmv1.udicast.com/${userLogin}/${userLogin}/playlist.m3u8`;
            setCurrentStreamUrl(smilUrl);
            setStreamTitle(`📺 Playlist: ${data.transmission.playlist_nome || data.transmission.titulo}`);
            console.log('🎵 Stream de playlist detectado:', smilUrl);
          } else if (data.stream_type === 'obs' && data.obs_stream?.is_live) {
            // Stream OBS
            const obsUrl = `https://stmv1.udicast.com/${userLogin}/${userLogin}_live/playlist.m3u8`;
            setCurrentStreamUrl(obsUrl);
            setStreamTitle(`📡 OBS: ${data.obs_stream.streamName || `${userLogin}_live`}`);
            console.log('📡 Stream OBS detectado:', obsUrl);
          }
        } else {
          // Sem transmissão ativa - limpar dados
          setCurrentStreamUrl('');
          setStreamTitle('');
          console.log('📴 Nenhuma transmissão ativa detectada');
          
          // Se não há transmissão ativa, encerrar todas as transmissões no painel
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
    }
  };

  const cleanupInactiveTransmissions = async () => {
    try {
      const token = await getToken();
      
      // Verificar se há transmissões marcadas como ativas no banco
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

      if (data.length > 0 && !selectedLogo) {
        setSelectedLogo(data[0].url);
      }
    } catch (error) {
      console.error('Erro ao carregar logos:', error);
    }
  };

  const renderPlayer = () => {
    // Usar Clappr player para HLS streams
    if (currentStreamUrl) {
      return (
        <ClapprStreamingPlayer
          src={currentStreamUrl}
          title={streamTitle}
          isLive={streamStatus?.is_live || false}
          autoplay={true}
          controls={true}
          className="w-full h-full"
          streamStats={streamStatus?.is_live ? {
            viewers: streamStatus.transmission?.stats.viewers || streamStatus.obs_stream?.viewers || 0,
            bitrate: streamStatus.transmission?.stats.bitrate || streamStatus.obs_stream?.bitrate || 0,
            uptime: streamStatus.transmission?.stats.uptime || streamStatus.obs_stream?.uptime || '00:00:00',
            quality: '1080p',
            isRecording: streamStatus.obs_stream?.recording || false
          } : undefined}
          onReady={() => console.log('Clappr player pronto')}
          onError={(error: any) => console.error('Erro no Clappr player:', error)}
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
        </div>
      </div>
    );
  };

  const getStreamStatusInfo = () => {
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
        {streamStatus?.is_live && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-green-800">
                  {streamStatus.stream_type === 'playlist' ? '📺 Transmissão de Playlist' : '📡 Transmissão OBS'}
                </h3>
                <p className="text-green-700 text-sm">
                  {streamTitle}
                </p>
                <p className="text-green-600 text-xs mt-1">
                  URL: {currentStreamUrl}
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

        {/* Seletor de Player */}
        {showPlayerSelector && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Tipo de Player</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'videojs',
                  name: 'Video.js',
                  description: 'Player profissional com HLS nativo',
                  icon: Monitor,
                  recommended: true
                },
                {
                  id: 'hlsjs',
                  name: 'HLS.js',
                  description: 'Player leve especializado em HLS',
                  icon: Wifi,
                  recommended: false
                },
                {
                  id: 'clappr',
                  name: 'Clappr',
                  description: 'Player brasileiro moderno',
                  icon: Play,
                  recommended: false
                }
              ].map((player) => (
                <div
                  key={player.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedPlayer === player.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPlayer(player.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <player.icon className={`h-5 w-5 ${
                        selectedPlayer === player.id ? 'text-primary-600' : 'text-gray-600'
                      }`} />
                      <h4 className="font-medium text-gray-900">{player.name}</h4>
                    </div>
                    {player.recommended && (
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{player.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configurações de Watermark */}
        {enableWatermark && logos.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Marca d'água</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      value={selectedLogo}
                      onChange={(e) => setSelectedLogo(e.target.value)}
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
                </>
              )}
            </div>

            {watermarkConfig.enabled && (
              <div className="mt-3">
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
            )}
          </div>
        )}
      </div>

      {/* Player Principal */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Player de Transmissão</h3>
          <div className="flex items-center space-x-2">
            {streamStatus?.is_live ? (
              <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-700">AO VIVO</span>
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
          {currentStreamUrl ? (
            renderPlayer()
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center">
                <WifiOff className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold mb-2">Nenhuma Transmissão Ativa</h3>
                <p className="text-gray-400 mb-4">
                  {connectionError ? 'Erro de conexão com o servidor' : 'Inicie uma transmissão para visualizar aqui'}
                </p>
                {connectionError && (
                  <button
                    onClick={loadStreamStatus}
                    className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 flex items-center mx-auto"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Informações do Stream */}
        {currentStreamUrl && (
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
                <span className="text-gray-600">Tipo:</span>
                <span className="ml-2 font-medium">
                  {streamStatus?.stream_type === 'playlist' ? 'Playlist SMIL' : 
                   streamStatus?.stream_type === 'obs' ? 'OBS Live' : 'Stream'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instruções de Uso */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <CheckCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-blue-900 font-medium mb-2">🎥 Como funciona o Player de Transmissão</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• <strong>Detecção Automática:</strong> O player detecta automaticamente se há transmissão ativa</li>
              <li>• <strong>Playlist SMIL:</strong> Quando uma playlist está sendo transmitida, usa URL SMIL</li>
              <li>• <strong>OBS Live:</strong> Quando há stream OBS ativo, conecta diretamente</li>
              <li>• <strong>Múltiplos Players:</strong> Escolha entre Video.js, HLS.js ou Clappr</li>
              <li>• <strong>Marca d'água:</strong> Adicione seu logo sobre o vídeo</li>
              <li>• <strong>Estatísticas:</strong> Veja espectadores e dados em tempo real</li>
              <li>• <strong>Auto-reconexão:</strong> Reconecta automaticamente se stream cair</li>
              <li>• <strong>Compatibilidade:</strong> Funciona em todos os navegadores e dispositivos</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status de Conexão Detalhado */}
      {!streamStatus?.is_live && !connectionError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-yellow-900 font-medium mb-2">📡 Nenhuma Transmissão Ativa</h3>
              <p className="text-yellow-800 text-sm mb-3">
                Para visualizar conteúdo no player, você precisa:
              </p>
              <ul className="text-yellow-800 text-sm space-y-1">
                <li>• <strong>Iniciar uma Playlist:</strong> Vá em "Playlists" e clique em "Transmitir Playlist"</li>
                <li>• <strong>Transmitir via OBS:</strong> Configure OBS com os dados de "Dados de Conexão"</li>
                <li>• <strong>Usar Relay RTMP:</strong> Configure um relay 24/7 em "Relay RTMP"</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamingPlayerManager;