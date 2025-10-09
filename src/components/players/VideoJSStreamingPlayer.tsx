import React, { useRef, useEffect, useState } from 'react';
import { Play, AlertCircle, RotateCcw, ExternalLink, Activity, Eye, Clock, Wifi, WifiOff } from 'lucide-react';

interface VideoJSStreamingPlayerProps {
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
  watermark?: {
    url: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity: number;
  };
}

const VideoJSStreamingPlayer: React.FC<VideoJSStreamingPlayerProps> = ({
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
  streamStats,
  watermark
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [showStats, setShowStats] = useState(false);

  // Usar player HTML5 simples em vez do Video.js para evitar problemas de DOM
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    setLoading(true);
    setConnectionStatus('connecting');

    console.log('🎥 Configurando player HTML5 simples:', src);

    // Configurar propriedades do vídeo
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = muted;
    video.autoplay = autoplay;
    video.controls = controls;

    // Adicionar token de autenticação se necessário
    let videoSrc = src;
    if (src.includes('/content/') || src.includes('/api/videos-ssh/')) {
      const token = localStorage.getItem('auth_token');
      if (token && !src.includes('auth_token=') && !src.includes('Authorization')) {
        const separator = src.includes('?') ? '&' : '?';
        videoSrc = `${src}${separator}auth_token=${encodeURIComponent(token)}`;
      }
    }

    video.src = videoSrc;

    // Event listeners
    const handleLoadStart = () => {
      setLoading(true);
      setConnectionStatus('connecting');
    };

    const handleCanPlay = () => {
      setLoading(false);
      setConnectionStatus('connected');
      if (onReady) onReady();
    };

    const handlePlay = () => {
      setConnectionStatus('connected');
      if (onPlay) onPlay();
    };

    const handlePause = () => {
      if (onPause) onPause();
    };

    const handleError = (e: Event) => {
      setLoading(false);
      setConnectionStatus('disconnected');
      const target = e.target as HTMLVideoElement;
      
      let errorMessage = 'Erro ao carregar stream';
      if (target.error) {
        switch (target.error.code) {
          case 1: errorMessage = 'Reprodução abortada'; break;
          case 2: errorMessage = 'Erro de rede - Verifique se a transmissão está ativa'; break;
          case 3: errorMessage = 'Erro de decodificação'; break;
          case 4: errorMessage = 'Stream não suportado ou offline'; break;
          default: errorMessage = 'Stream offline ou inacessível';
        }
      }
      
      setError(errorMessage);
      if (onError) onError(e);
    };

    const handleWaiting = () => {
      setLoading(true);
    };

    const handlePlaying = () => {
      setLoading(false);
      setConnectionStatus('connected');
    };

    // Adicionar listeners
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [src, autoplay, muted, controls, onReady, onPlay, onPause, onError]);

  const retry = () => {
    setError(null);
    setLoading(true);
    
    const video = videoRef.current;
    if (video && src) {
      video.load();
    }
  };

  const openInNewTab = () => {
    if (src) {
      window.open(src, '_blank');
    }
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Activity className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  if (!src) {
    return (
      <div className={`aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex flex-col items-center justify-center text-white ${className}`}>
        <Play className="h-16 w-16 mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold mb-2">Player de Streaming</h3>
        <p className="text-gray-400 text-center max-w-md">
          Player otimizado para transmissões HLS/M3U8 ao vivo
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`videojs-streaming-player relative bg-black rounded-lg overflow-hidden aspect-video ${className}`}>
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
          {getConnectionIcon()}
          <span className="text-xs">{connectionStatus}</span>
        </div>
      </div>

      {/* Marca d'água */}
      {watermark && (
        <div
          className={`absolute z-10 pointer-events-none ${
            watermark.position === 'top-left' ? 'top-4 left-4' :
            watermark.position === 'top-right' ? 'top-4 right-4' :
            watermark.position === 'bottom-left' ? 'bottom-20 left-4' :
            'bottom-20 right-4'
          }`}
          style={{ opacity: watermark.opacity / 100 }}
        >
          <img
            src={watermark.url}
            alt="Watermark"
            className="max-w-24 max-h-12 object-contain"
          />
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
            {streamStats.quality && (
              <div className="flex items-center space-x-2">
                <span>{streamStats.quality}</span>
              </div>
            )}
            {streamStats.isRecording && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span>Gravando</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botão de estatísticas */}
      {streamStats && (
        <div className="absolute top-4 right-16 z-20">
          <button
            onClick={() => setShowStats(!showStats)}
            className="bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-opacity"
            title="Estatísticas"
          >
            <Activity className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-50 rounded-lg">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <span className="text-white text-sm">
              {connectionStatus === 'connecting' ? 'Conectando ao stream...' : 'Carregando player...'}
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black bg-opacity-75 rounded-lg">
          <div className="flex flex-col items-center space-y-4 text-white text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Erro no Stream</h3>
              <p className="text-sm text-gray-300 mb-4">{error}</p>
              <div className="flex space-x-3">
                <button
                  onClick={retry}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Tentar Novamente</span>
                </button>
                {src && (
                  <button
                    onClick={openInNewTab}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Abrir Direto</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Elemento de vídeo HTML5 simples */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls={controls}
        playsInline
        crossOrigin="anonymous"
      />

      {/* Título do stream */}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pointer-events-none rounded-b-lg">
          <h3 className="text-white text-lg font-semibold truncate">{title}</h3>
          {streamStats && (
            <div className="text-white text-sm opacity-80 mt-1">
              {streamStats.quality && <span>{streamStats.quality}</span>}
              {streamStats.bitrate && <span> • {streamStats.bitrate} kbps</span>}
              {isLive && <span> • AO VIVO</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoJSStreamingPlayer;