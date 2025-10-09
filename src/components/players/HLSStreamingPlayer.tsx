import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, AlertCircle, RotateCcw, ExternalLink, Activity, Eye, Clock, Wifi, WifiOff } from 'lucide-react';

interface HLSStreamingPlayerProps {
  src?: string;
  title?: string;
  isLive?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: any) => void;
  streamStats?: {
    viewers?: number;
    bitrate?: number;
    uptime?: string;
    quality?: string;
    isRecording?: boolean;
  };
}

declare global {
  interface Window {
    Hls: any;
  }
}

const HLSStreamingPlayer: React.FC<HLSStreamingPlayerProps> = ({
  src,
  title,
  isLive = false,
  autoplay = false,
  muted = false,
  controls = true,
  className = '',
  onReady,
  onPlay,
  onPause,
  onError,
  streamStats
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [showStats, setShowStats] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Carregar HLS.js dinamicamente
  useEffect(() => {
    const loadHLS = async () => {
      if (window.Hls) {
        initializeHLS();
        return;
      }

      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        script.onload = () => initializeHLS();
        script.onerror = () => {
          setError('Erro ao carregar HLS.js');
          setLoading(false);
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Erro ao carregar HLS.js:', error);
        setError('Erro ao carregar player HLS');
        setLoading(false);
      }
    };

    const initializeHLS = () => {
      if (!src || !videoRef.current) return;

      setLoading(true);
      setError(null);
      setConnectionStatus('connecting');

      // Limpar HLS anterior
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      console.log('🎥 Inicializando HLS.js para streaming:', src);

      if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls({
          enableWorker: true,
          lowLatencyMode: isLive,
          backBufferLength: isLive ? 10 : 30,
          maxBufferLength: isLive ? 20 : 60,
          liveSyncDurationCount: isLive ? 3 : 5,
          debug: false,
          xhrSetup: (xhr: XMLHttpRequest, url: string) => {
            xhr.withCredentials = false;
            xhr.timeout = 15000;
          }
        });

        hls.loadSource(src);
        hls.attachMedia(videoRef.current);

        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ HLS manifest carregado para streaming');
          setLoading(false);
          setConnectionStatus('connected');
          
          if (onReady) onReady();

          if (autoplay) {
            setTimeout(() => {
              videoRef.current?.play().catch(error => {
                console.warn('Autoplay falhou:', error);
              });
            }, 100);
          }
        });

        hls.on(window.Hls.Events.ERROR, (event: any, data: any) => {
          console.error('HLS streaming error:', data);
          
          if (data.fatal) {
            setLoading(false);
            setConnectionStatus('disconnected');
            
            let errorMessage = 'Erro no stream';
            
            switch (data.type) {
              case window.Hls.ErrorTypes.NETWORK_ERROR:
                errorMessage = 'Erro de rede. Stream pode estar offline.';
                break;
              case window.Hls.ErrorTypes.MEDIA_ERROR:
                errorMessage = 'Erro de mídia. Formato não suportado.';
                break;
              default:
                if (data.details?.includes('404')) {
                  errorMessage = 'Stream não encontrado. Verifique se a transmissão está ativa.';
                } else if (data.details?.includes('timeout')) {
                  errorMessage = 'Timeout na conexão. Stream pode estar instável.';
                }
            }
            
            setError(errorMessage);
            if (onError) onError(data);
            
            // Auto-retry para streams ao vivo
            if (isLive && retryCount < maxRetries) {
              setTimeout(() => {
                setRetryCount(prev => prev + 1);
                retry();
              }, 5000);
            }
          }
        });

        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari nativo
        console.log('🍎 Usando Safari nativo para HLS streaming');
        videoRef.current.src = src;
        setLoading(false);
        setConnectionStatus('connected');
        
        if (onReady) onReady();

        if (autoplay) {
          setTimeout(() => {
            videoRef.current?.play().catch(error => {
              console.warn('Autoplay falhou:', error);
            });
          }, 100);
        }
      } else {
        setError('HLS não suportado neste navegador');
        setLoading(false);
      }
    };

    loadHLS();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoplay, isLive]);

  // Event listeners do vídeo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      if (onPlay) onPlay();
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (onPause) onPause();
    };

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleError = (e: Event) => {
      if (!hlsRef.current) { // Só processar se não for erro do HLS.js
        setLoading(false);
        setConnectionStatus('disconnected');
        const target = e.target as HTMLVideoElement;
        
        let errorMsg = 'Erro no stream';
        if (target.error) {
          switch (target.error.code) {
            case 2: errorMsg = 'Erro de rede - Stream offline'; break;
            case 3: errorMsg = 'Erro de decodificação'; break;
            case 4: errorMsg = 'Stream não suportado'; break;
          }
        }
        
        setError(errorMsg);
        if (onError) onError(e);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('error', handleError);
    };
  }, [onPlay, onPause, onError]);

  // Auto-hide controles
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', () => {
        if (isPlaying) setShowControls(false);
      });
    }

    return () => {
      clearTimeout(timeout);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', () => {});
      }
    };
  }, [isPlaying]);

  // Controles de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.error);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    video.muted = newVolume === 0;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || isLive) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    setConnectionStatus('connecting');
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    // Recarregar o vídeo
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  };

  const formatTime = (time: number): string => {
    if (!isFinite(time)) return '0:00';

    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`hls-streaming-player relative bg-black rounded-lg overflow-hidden aspect-video ${className}`}
    >
      {/* Elemento de vídeo */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted={muted}
        playsInline
        crossOrigin="anonymous"
      />

      {/* Indicador de transmissão ao vivo */}
      {isLive && (
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-red-600 text-white px-3 py-1 rounded-full flex items-center space-x-2 text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>AO VIVO</span>
          </div>
        </div>
      )}

      {/* Status da conexão */}
      <div className="absolute top-4 right-4 z-20">
        <div className="bg-black bg-opacity-60 text-white px-2 py-1 rounded-full flex items-center space-x-1">
          {connectionStatus === 'connected' ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : connectionStatus === 'connecting' ? (
            <Activity className="h-4 w-4 text-yellow-500 animate-pulse" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <span className="text-xs">{connectionStatus}</span>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-50">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <span className="text-white text-sm">Carregando stream...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-75">
          <div className="flex flex-col items-center space-y-4 text-white text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Stream Offline</h3>
              <p className="text-sm text-gray-300 mb-4">{error}</p>
              <div className="flex space-x-3">
                <button
                  onClick={retry}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reconectar</span>
                </button>
                {src && (
                  <button
                    onClick={() => window.open(src, '_blank')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Abrir Direto</span>
                  </button>
                )}
              </div>
              {retryCount > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Tentativas: {retryCount}/{maxRetries}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Placeholder quando não há stream */}
      {!src && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-white">
          <Play className="h-16 w-16 mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold mb-2">HLS Streaming Player</h3>
          <p className="text-gray-400 text-center max-w-md">
            Player otimizado para transmissões HLS/M3U8 ao vivo
          </p>
        </div>
      )}

      {/* Estatísticas do stream */}
      {streamStats && showStats && (
        <div className="absolute bottom-20 left-4 z-20 bg-black bg-opacity-80 text-white p-3 rounded-lg text-sm">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Eye className="h-3 w-3" />
              <span>{streamStats.viewers || 0} espectadores</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="h-3 w-3" />
              <span>{streamStats.bitrate || 0} kbps</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-3 w-3" />
              <span>{streamStats.uptime || '00:00:00'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Controles customizados */}
      {controls && src && (
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseEnter={() => setShowControls(true)}
        >
          {/* Botão de play central */}
          {!isPlaying && !loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={togglePlay}
                className="bg-black bg-opacity-60 text-white p-4 rounded-full hover:bg-opacity-80 transition-opacity"
              >
                <Play className="h-8 w-8" />
              </button>
            </div>
          )}

          {/* Barra de controles inferior */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {/* Barra de progresso (apenas para VOD) */}
            {!isLive && duration > 0 && (
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.3) 0%)`
                  }}
                />
              </div>
            )}

            {/* Controles principais */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-accent transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-accent transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="h-6 w-6" />
                    ) : (
                      <Volume2 className="h-6 w-6" />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-gray-500 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                <div className="text-white text-sm">
                  {isLive ? (
                    <div className="flex items-center space-x-2">
                      <span>Ao vivo</span>
                      {streamStats?.uptime && (
                        <>
                          <span>•</span>
                          <span>{streamStats.uptime}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {streamStats && (
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className="text-white hover:text-accent transition-colors"
                    title="Estatísticas"
                  >
                    <Activity className="h-5 w-5" />
                  </button>
                )}

                <button
                  onClick={toggleFullscreen}
                  className="text-white hover:text-accent transition-colors"
                  title="Tela cheia"
                >
                  {isFullscreen ? (
                    <Minimize className="h-5 w-5" />
                  ) : (
                    <Maximize className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Título do stream */}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pointer-events-none">
          <h3 className="text-white text-lg font-semibold truncate">{title}</h3>
          {streamStats && (
            <div className="text-white text-sm opacity-80 mt-1">
              {streamStats.quality && <span>{streamStats.quality}</span>}
              {streamStats.bitrate && <span> • {streamStats.bitrate} kbps</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HLSStreamingPlayer;