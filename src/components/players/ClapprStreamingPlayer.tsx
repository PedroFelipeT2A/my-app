import React, { useRef, useEffect, useState } from 'react';
import { Play, AlertCircle, RotateCcw, ExternalLink, Activity, Eye, Clock, Wifi, WifiOff } from 'lucide-react';

interface ClapprStreamingPlayerProps {
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
    Clappr: any;
  }
}

const ClapprStreamingPlayer: React.FC<ClapprStreamingPlayerProps> = ({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [showStats, setShowStats] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Cleanup function
  const cleanupPlayer = () => {
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }
        playerRef.current = null;
        console.log('✅ Clappr player limpo');
      } catch (error) {
        console.warn('Erro ao limpar Clappr player:', error);
        playerRef.current = null;
      }
    }
  };

  // Carregar Clappr dinamicamente
  useEffect(() => {
    const loadClappr = async () => {
      if (window.Clappr) {
        initializeClappr();
        return;
      }

      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/clappr@latest/dist/clappr.min.js';
        script.onload = () => {
          // Carregar plugin de seleção de qualidade
          const qualityScript = document.createElement('script');
          qualityScript.src = 'https://cdn.jsdelivr.net/gh/clappr/clappr-level-selector-plugin@latest/dist/level-selector.min.js';
          qualityScript.onload = () => initializeClappr();
          qualityScript.onerror = () => initializeClappr(); // Continuar mesmo sem plugin
          document.head.appendChild(qualityScript);
        };
        script.onerror = () => {
          setError('Erro ao carregar Clappr');
          setLoading(false);
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Erro ao carregar Clappr:', error);
        setError('Erro ao carregar player');
        setLoading(false);
      }
    };

    const initializeClappr = () => {
      if (!containerRef.current || !window.Clappr || !src) return;

      setLoading(false);
      setError(null);
      setConnectionStatus('connecting');

      try {
        console.log('🎥 Inicializando Clappr para streaming:', src);

        // Configurações do Clappr
        const playerConfig: any = {
          source: src,
          parent: containerRef.current,
          width: '100%',
          height: '100%',
          autoPlay: autoplay,
          mute: muted,
          controls: controls,
          plugins: [],
          hlsjsConfig: {
            enableWorker: true,
            lowLatencyMode: isLive,
            backBufferLength: isLive ? 10 : 30,
            maxBufferLength: isLive ? 20 : 60,
            liveSyncDurationCount: isLive ? 3 : 5,
            debug: false
          }
        };

        // Adicionar plugin de qualidade se disponível
        if (window.LevelSelector) {
          playerConfig.plugins.push(window.LevelSelector);
          playerConfig.levelSelectorConfig = {
            labelCallback: (playbackLevel: any, customLabel: string) => {
              return playbackLevel.level.height + 'p';
            }
          };
        }

        const player = new window.Clappr.Player(playerConfig);
        playerRef.current = player;

        // Event listeners
        player.on(window.Clappr.Events.PLAYER_READY, () => {
          console.log('✅ Clappr streaming player pronto');
          setLoading(false);
          setConnectionStatus('connected');
          setRetryCount(0);

          if (onReady) onReady();
        });

        player.on(window.Clappr.Events.PLAYER_PLAY, () => {
          console.log('▶️ Clappr streaming play');
          setLoading(false);
          setConnectionStatus('connected');
          if (onPlay) onPlay();
        });

        player.on(window.Clappr.Events.PLAYER_PAUSE, () => {
          console.log('⏸️ Clappr streaming pause');
          if (onPause) onPause();
        });

        player.on(window.Clappr.Events.PLAYER_PLAYING, () => {
          console.log('🎬 Clappr streaming playing');
          setLoading(false);
          setConnectionStatus('connected');
        });

        player.on(window.Clappr.Events.PLAYER_ERROR, (error: any) => {
          console.error('❌ Clappr streaming error:', error);
          setLoading(false);
          setConnectionStatus('disconnected');
          
          let errorMessage = 'Erro no stream';
          if (error && error.message) {
            if (error.message.includes('404')) {
              errorMessage = 'Stream não encontrado. Verifique se a transmissão está ativa.';
            } else if (error.message.includes('timeout')) {
              errorMessage = 'Timeout na conexão. Stream pode estar offline.';
            } else {
              errorMessage = error.message;
            }
          }
          
          setError(errorMessage);
          if (onError) onError(error);
          
          // Auto-retry para streams ao vivo
          if (isLive && retryCount < maxRetries) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              retry();
            }, 5000);
          }
        });

        player.on(window.Clappr.Events.PLAYER_LOADSTART, () => {
          console.log('⏳ Clappr load start');
          setConnectionStatus('connecting');
        });

        player.on(window.Clappr.Events.PLAYER_CANPLAY, () => {
          console.log('✅ Clappr can play');
          setLoading(false);
          setConnectionStatus('connected');
        });

        player.on(window.Clappr.Events.PLAYER_LOADEDDATA, () => {
          console.log('📦 Clappr loaded data');
          setLoading(false);
          setConnectionStatus('connected');
        });

        player.on(window.Clappr.Events.PLAYER_LOADEDMETADATA, () => {
          console.log('📋 Clappr loaded metadata');
          setLoading(false);
        });

      } catch (error) {
        console.error('Erro ao inicializar Clappr:', error);
        setError('Erro ao inicializar player');
        setLoading(false);
        
        if (retryCount < maxRetries) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            cleanupPlayer();
            initializeClappr();
          }, 2000);
        }
      }
    };

    loadClappr();

    return () => {
      cleanupPlayer();
    };
  }, [src, autoplay, muted, isLive]);

  const retry = () => {
    setError(null);
    setLoading(true);
    setRetryCount(0);
    
    cleanupPlayer();
    
    setTimeout(() => {
      if (containerRef.current && window.Clappr && src) {
        // Reinicializar player
        const event = new Event('retry');
        containerRef.current.dispatchEvent(event);
      }
    }, 1000);
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

  return (
    <div className={`clappr-streaming-player relative bg-black rounded-lg overflow-hidden aspect-video ${className}`}>
      {/* Container do Clappr */}
      <div ref={containerRef} className="w-full h-full" />


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
            </div>
          </div>
        </div>
      )}

      {/* Placeholder quando não há stream */}
      {!src && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-800 to-purple-900 text-white">
          <Play className="h-16 w-16 mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold mb-2">Clappr Streaming Player</h3>
          <p className="text-gray-400 text-center max-w-md">
            Player brasileiro otimizado para transmissões HLS ao vivo
          </p>
        </div>
      )}

    </div>
  );
};

export default ClapprStreamingPlayer;