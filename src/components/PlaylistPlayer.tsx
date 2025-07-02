import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize, Minimize, List, Shuffle, Repeat } from 'lucide-react';

interface Video {
  id: number;
  nome: string;
  url: string;
  duracao?: number;
}

interface PlaylistPlayerProps {
  videos: Video[];
  autoplay?: boolean;
  shuffle?: boolean;
  repeat?: boolean;
  onVideoChange?: (video: Video, index: number) => void;
  onPlaylistEnd?: () => void;
  className?: string;
}

const PlaylistPlayer: React.FC<PlaylistPlayerProps> = ({
  videos,
  autoplay = false,
  shuffle = false,
  repeat = true,
  onVideoChange,
  onPlaylistEnd,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playOrder, setPlayOrder] = useState<number[]>([]);

  // Inicializar ordem de reprodução
  useEffect(() => {
    if (videos.length > 0) {
      const order = Array.from({ length: videos.length }, (_, i) => i);
      if (shuffle) {
        // Embaralhar array
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
      }
      setPlayOrder(order);
    }
  }, [videos, shuffle]);

  // Notificar mudança de vídeo
  useEffect(() => {
    if (videos.length > 0 && currentIndex < videos.length) {
      const currentVideo = videos[playOrder[currentIndex]];
      if (currentVideo && onVideoChange) {
        onVideoChange(currentVideo, currentIndex);
      }
    }
  }, [currentIndex, videos, playOrder, onVideoChange]);

  // Auto-play quando necessário
  useEffect(() => {
    if (autoplay && videoRef.current && videos.length > 0) {
      videoRef.current.play().catch(console.error);
    }
  }, [autoplay, currentIndex]);

  // Eventos do vídeo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      handleNext();
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [currentIndex]);

  // Controle de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

    const container = videoRef.current?.parentElement;
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

  const getCurrentVideo = () => {
    if (videos.length === 0 || currentIndex >= playOrder.length) return null;
    return videos[playOrder[currentIndex]];
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.error);
    }
  };

  const handleNext = () => {
    if (currentIndex < playOrder.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (repeat) {
      setCurrentIndex(0);
    } else {
      setIsPlaying(false);
      if (onPlaylistEnd) {
        onPlaylistEnd();
      }
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else if (repeat) {
      setCurrentIndex(playOrder.length - 1);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    video.muted = newVolume === 0;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const playVideoAtIndex = (index: number) => {
    setCurrentIndex(index);
    setShowPlaylist(false);
  };

  const formatTime = (time: number): string => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const currentVideo = getCurrentVideo();

  if (!currentVideo) {
    return (
      <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
        <div className="aspect-video flex items-center justify-center">
          <p className="text-white text-lg">Nenhum vídeo na playlist</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Vídeo */}
      <video
        ref={videoRef}
        src={currentVideo.url}
        className="w-full h-full object-contain"
        preload="metadata"
      />

      {/* Overlay de informações */}
      <div className="absolute top-4 left-4 z-20">
        <div className="bg-black bg-opacity-70 text-white px-3 py-2 rounded-md">
          <div className="text-sm font-medium">{currentVideo.nome}</div>
          <div className="text-xs opacity-80">
            {currentIndex + 1} de {videos.length} • Playlist
          </div>
        </div>
      </div>

      {/* Botão da playlist */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setShowPlaylist(!showPlaylist)}
          className="bg-black bg-opacity-70 text-white p-2 rounded-md hover:bg-opacity-90 transition-opacity"
        >
          <List className="h-5 w-5" />
        </button>
      </div>

      {/* Controles */}
      {showControls && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300">
          {/* Botão de play central */}
          {!isPlaying && (
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
            {/* Barra de progresso */}
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

            {/* Controles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePrevious}
                  className="text-white hover:text-accent transition-colors"
                >
                  <SkipBack className="h-6 w-6" />
                </button>

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

                <button
                  onClick={handleNext}
                  className="text-white hover:text-accent transition-colors"
                >
                  <SkipForward className="h-6 w-6" />
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
                    style={{
                      background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.3) 0%)`
                    }}
                  />
                </div>

                <div className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  className="text-white hover:text-accent transition-colors"
                  title="Lista de reprodução"
                >
                  <List className="h-5 w-5" />
                </button>

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

      {/* Lista de reprodução */}
      {showPlaylist && (
        <div className="absolute top-0 right-0 w-80 h-full bg-black bg-opacity-90 text-white overflow-y-auto z-30">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Lista de Reprodução</h3>
              <button
                onClick={() => setShowPlaylist(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {videos.map((video, index) => {
                const playOrderIndex = playOrder.indexOf(index);
                const isCurrentVideo = playOrderIndex === currentIndex;
                
                return (
                  <div
                    key={video.id}
                    onClick={() => playVideoAtIndex(playOrderIndex)}
                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                      isCurrentVideo
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-sm text-gray-400">
                        {playOrderIndex + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {video.nome}
                        </div>
                        {video.duracao && (
                          <div className="text-xs text-gray-400">
                            {formatTime(video.duracao)}
                          </div>
                        )}
                      </div>
                      {isCurrentVideo && (
                        <div className="text-primary-300">
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistPlayer;