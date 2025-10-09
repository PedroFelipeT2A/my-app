import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStream } from '../../context/StreamContext';
import {
  Activity, Users, Zap, Clock, Play, Square, Radio, Video, Pause,
  TrendingUp, Globe, Monitor, Smartphone, Eye, Settings,
  AlertCircle, CheckCircle, Wifi, WifiOff, Server, HardDrive, RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';
import ClapprStreamingPlayer from '../../components/players/ClapprStreamingPlayer';
import StreamingControlInline from '../../components/StreamingControlInline';

interface DashboardStats {
  totalVideos: number;
  totalPlaylists: number;
  totalEspaco: number;
  espacoUsado: number;
  transmissaoAtiva: boolean;
  espectadoresAtivos: number;
  ultimaTransmissao?: string;
}

interface StreamStatus {
  is_live: boolean;
  stream_type?: 'playlist' | 'obs';
  transmission?: {
    id: number;
    titulo: string;
    codigo_playlist: number;
    stats: {
      viewers: number;
      bitrate: number;
      uptime: string;
    };
    platforms: any[];
  };
  obs_stream?: {
    is_live: boolean;
    viewers: number;
    bitrate: number;
    uptime: string;
    recording: boolean;
  };
}

interface RecentVideo {
  id: number;
  nome: string;
  url: string;
  duracao?: number;
  data_upload: string;
}

const Dashboard: React.FC = () => {
  const { user, getToken } = useAuth();
  const { streamData } = useStream();
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    totalPlaylists: 0,
    totalEspaco: 0,
    espacoUsado: 0,
    transmissaoAtiva: false,
    espectadoresAtivos: 0
  });
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');
  const [showPlayer, setShowPlayer] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [playlistName, setPlaylistName] = useState<string>('');
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [wowzaControlLoading, setWowzaControlLoading] = useState(false);
  const [wowzaStatus, setWowzaStatus] = useState<{running: boolean; message: string} | null>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
  const [startingPlaylist, setStartingPlaylist] = useState(false);

  // Para revendas, usar effective_user_id
  const effectiveUserId = user?.effective_user_id || user?.id;
  const userLogin = user?.usuario || (user?.email ? user.email.split('@')[0] : `user_${effectiveUserId || 'usuario'}`);

  useEffect(() => {
    loadDashboardData();
    checkWowzaStatus();
    loadPlaylists();

    // Atualizar dados a cada 60 segundos (reduzido para melhor performance)
    const interval = setInterval(() => {
      loadDashboardData();
      checkWowzaStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handlePauseTransmission = async () => {
    if (!confirm('Deseja pausar a transmissão atual?')) return;
    
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('Transmissão pausada');
        loadStreamStatus();
      } else {
        toast.error(result.error || 'Erro ao pausar transmissão');
      }
    } catch (error) {
      console.error('Erro ao pausar transmissão:', error);
      toast.error('Erro ao pausar transmissão');
    }
  };

  const handleStopTransmission = async () => {
    if (!confirm('Deseja finalizar a transmissão atual?')) return;

    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transmission_id: streamStatus?.transmission?.id,
          stream_type: streamStatus?.stream_type || 'playlist'
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Transmissão finalizada');
        loadStreamStatus();
        setShowPlayer(false);
        setCurrentVideoUrl('');
      } else {
        toast.error(result.error || 'Erro ao finalizar transmissão');
      }
    } catch (error) {
      console.error('Erro ao finalizar transmissão:', error);
      toast.error('Erro ao finalizar transmissão');
    }
  };

  const checkWowzaStatus = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/wowza-control/status', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setWowzaStatus({
          running: data.running || false,
          message: data.message || ''
        });
      }
    } catch (error) {
      console.error('Erro ao verificar status Wowza:', error);
    }
  };

  const handleWowzaStart = async () => {
    setWowzaControlLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/wowza-control/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Aplicação Wowza iniciada: ${result.user}`);
        checkWowzaStatus();
        loadStreamStatus();
      } else {
        toast.error(result.error || 'Erro ao iniciar aplicação');
      }
    } catch (error) {
      console.error('Erro ao iniciar aplicação Wowza:', error);
      toast.error('Erro ao iniciar aplicação Wowza');
    } finally {
      setWowzaControlLoading(false);
    }
  };

  const handleWowzaStop = async () => {
    if (!confirm('Deseja parar a aplicação Wowza? Isso interromperá todas as transmissões.')) return;

    setWowzaControlLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/wowza-control/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Aplicação Wowza parada: ${result.user}`);
        checkWowzaStatus();
        loadStreamStatus();
      } else {
        toast.error(result.error || 'Erro ao parar aplicação');
      }
    } catch (error) {
      console.error('Erro ao parar aplicação Wowza:', error);
      toast.error('Erro ao parar aplicação Wowza');
    } finally {
      setWowzaControlLoading(false);
    }
  };

  const handleWowzaRestart = async () => {
    if (!confirm('Deseja reiniciar a aplicação Wowza? Isso causará uma breve interrupção.')) return;

    setWowzaControlLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/wowza-control/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Aplicação Wowza reiniciada: ${result.user}`);
        checkWowzaStatus();
        loadStreamStatus();
      } else {
        toast.error(result.error || 'Erro ao reiniciar aplicação');
      }
    } catch (error) {
      console.error('Erro ao reiniciar aplicação Wowza:', error);
      toast.error('Erro ao reiniciar aplicação Wowza');
    } finally {
      setWowzaControlLoading(false);
    }
  };
  const loadDashboardData = async () => {
    if (loadingStats) return; // Evitar múltiplas chamadas simultâneas
    
    setLoadingStats(true);
    try {
      await Promise.all([
        loadStats(),
        loadStreamStatus(),
        // loadRecentVideos() // Comentado para melhor performance inicial
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
      setLoadingStats(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = await getToken();
      
      // Carregar apenas dados essenciais para melhor performance
      const [foldersResponse, playlistsResponse] = await Promise.all([
        fetch('/api/folders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/playlists', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let espacoUsado = 0;
      let totalVideos = 0;

      if (foldersResponse.ok) {
        const folders = await foldersResponse.json();
        espacoUsado = folders.reduce((acc: number, folder: any) => acc + (folder.espaco_usado || 0), 0);
        totalVideos = folders.reduce((acc: number, folder: any) => acc + (folder.video_count_db || 0), 0);
      }


      let totalPlaylists = 0;
      if (playlistsResponse.ok) {
        const playlists = await playlistsResponse.json();
        totalPlaylists = Array.isArray(playlists) ? playlists.length : 0;
      }

      setStats({
        totalVideos,
        totalPlaylists,
        totalEspaco: user?.espaco || 1000,
        espacoUsado,
        transmissaoAtiva: streamStatus?.is_live || false,
        espectadoresAtivos: streamStatus?.transmission?.stats.viewers || streamStatus?.obs_stream?.viewers || 0
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const loadStreamStatus = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStreamStatus(data);
        
        // Definir URL do player e nome baseado no status
        if (data.is_live) {
          if (data.stream_type === 'obs' && data.obs_stream?.is_live) {
            // Para OBS, usar URL do player na porta do sistema
            const baseUrl = window.location.protocol === 'https:' 
              ? `https://${window.location.hostname}:3001`
              : `http://${window.location.hostname}:3001`;
            setCurrentVideoUrl(`${baseUrl}/api/player-port/iframe?login=${userLogin}&player=1&contador=true`);
            setPlaylistName(`📡 OBS: ${data.obs_stream.streamName || `${userLogin}_live`}`);
          } else if (data.transmission) {
            // Para playlist, usar URL do player na porta do sistema
            const baseUrl = window.location.protocol === 'https:' 
              ? `https://${window.location.hostname}:3001`
              : `http://${window.location.hostname}:3001`;
            setCurrentVideoUrl(`${baseUrl}/api/player-port/iframe?login=${userLogin}&playlist=${data.transmission.codigo_playlist}&player=1&contador=true&compartilhamento=true`);
            
            // Usar nome da playlist da resposta
            setPlaylistName(data.transmission.playlist_nome ? 
              `📺 Playlist: ${data.transmission.playlist_nome}` : 
              data.transmission.titulo);
          }
          setShowPlayer(true);
          setPlayerError(null);
        } else {
          setShowPlayer(false);
          setPlaylistName('');
          setPlayerError(null);
        }
        
        // Log de debug para verificar conexão Wowza
        if (data.wowza_info?.connection_error) {
          console.warn('⚠️ Problema na conexão Wowza:', data.wowza_info.connection_error);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar status de transmissão:', error);
      setPlayerError('Erro ao carregar status de transmissão');
    }
  };

  const loadRecentVideos = async () => {
    try {
      const token = await getToken();

      // Tentar carregar vídeos da primeira pasta disponível
      const foldersResponse = await fetch('/api/folders', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (foldersResponse.ok) {
        const folders = await foldersResponse.json();
        if (folders.length > 0) {
          const videosResponse = await fetch(`/api/videos?folder_id=${folders[0].id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (videosResponse.ok) {
            const videos = await videosResponse.json();
            setRecentVideos(Array.isArray(videos) ? videos.slice(0, 5) : []);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vídeos recentes:', error);
    }
  };

  const loadPlaylists = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/playlists', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylists(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Erro ao carregar playlists:', error);
    }
  };

  const handleStartPlaylist = async () => {
    if (!selectedPlaylist) {
      toast.error('Selecione uma playlist primeiro');
      return;
    }

    const playlist = playlists.find(p => p.id.toString() === selectedPlaylist);
    if (!playlist) {
      toast.error('Playlist não encontrada');
      return;
    }

    setStartingPlaylist(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          titulo: `Transmissão: ${playlist.nome}`,
          descricao: 'Transmissão iniciada via Dashboard',
          playlist_id: parseInt(selectedPlaylist),
          enable_recording: false,
          use_smil: true,
          loop_playlist: true
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Playlist "${playlist.nome}" iniciada com sucesso!`);
        setSelectedPlaylist('');
        loadStreamStatus();
      } else {
        toast.error(result.error || 'Erro ao iniciar playlist');
      }
    } catch (error) {
      console.error('Erro ao iniciar playlist:', error);
      toast.error('Erro ao iniciar playlist');
    } finally {
      setStartingPlaylist(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStoragePercentage = () => {
    return Math.round((stats.espacoUsado / stats.totalEspaco) * 100);
  };

  const getStorageColor = () => {
    const percentage = getStoragePercentage();
    if (percentage > 90) return 'bg-red-500';
    if (percentage > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Olá, {user?.nome || 'Usuário'}! 👋
              </h1>
              <p className="text-purple-100 text-lg">
                Bem-vindo ao seu painel de streaming
              </p>
              <div className="mt-4 flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4" />
                  <span>Plano: {user?.tipo === 'revenda' ? 'Revenda' : 'Streaming'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4" />
                  <span>Bitrate: {user?.bitrate || 2500} kbps</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Espectadores: {user?.espectadores || 100}</span>
                </div>
              </div>
            </div>
            
            {streamStatus?.is_live && (
              <div className="text-right">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-lg font-semibold">AO VIVO</span>
                </div>
                <div className="text-purple-100 text-sm">
                  {streamStatus.stream_type === 'obs' ? 'Transmissão OBS' : 'Transmissão Playlist'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Vídeos</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalVideos}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <TrendingUp className="h-4 w-4 mr-1" />
            <span>Biblioteca de conteúdo</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Playlists</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPlaylists}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Play className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <Activity className="h-4 w-4 mr-1" />
            <span>Conteúdo organizado</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Espectadores</p>
              <p className="text-3xl font-bold text-gray-900">{stats.espectadoresAtivos}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            {streamStatus?.is_live ? (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                <span>Ao vivo agora</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                <span>Audiência total</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Armazenamento</p>
              <p className="text-3xl font-bold text-gray-900">{getStoragePercentage()}%</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <HardDrive className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
              <span>{stats.espacoUsado} MB usado</span>
              <span>{stats.totalEspaco} MB total</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStorageColor()}`}
                style={{ width: `${getStoragePercentage()}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>


      {/* Player Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-gray-900">Player de Transmissão</h2>
                {streamStatus?.is_live && (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-red-500 rounded-full shadow-lg">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold text-white">AO VIVO</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4">
              {/* Player - 3 colunas - SEMPRE ATIVO */}
              <div className="lg:col-span-3 bg-black rounded-lg overflow-hidden" style={{ paddingTop: '56.25%', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  <ClapprStreamingPlayer
                    src={`https://stmv1.udicast.com/${userLogin}/${userLogin}/playlist.m3u8`}
                    title={playlistName || 'Transmissão'}
                    isLive={true}
                    autoplay={true}
                    controls={true}
                    className="w-full h-full"
                    streamStats={{
                      viewers: streamStatus?.transmission?.stats.viewers || streamStatus?.obs_stream?.viewers || 0,
                      bitrate: streamStatus?.transmission?.stats.bitrate || streamStatus?.obs_stream?.bitrate || 0,
                      uptime: streamStatus?.transmission?.stats.uptime || streamStatus?.obs_stream?.uptime || '00:00:00',
                      quality: '1080p',
                      isRecording: streamStatus?.obs_stream?.recording || false
                    }}
                    onError={(error) => {
                      console.error('Erro no player do dashboard:', error);
                      setPlayerError('Erro ao carregar player');
                    }}
                    onReady={() => {
                      console.log('Player Clappr do dashboard pronto');
                      setPlayerError(null);
                    }}
                  />
                </div>
              </div>
            </div>

              {/* Controle de Streaming - 1 coluna */}
              <div className="lg:col-span-1 space-y-3">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                    <Server className="h-4 w-4 mr-2" />
                    Controle de Streaming
                  </h3>

                  {wowzaStatus && (
                    <div className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg mb-3 ${wowzaStatus.running ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${wowzaStatus.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                      <span className="font-medium text-xs">
                        {wowzaStatus.running ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <button
                      onClick={handleWowzaStart}
                      disabled={wowzaControlLoading || wowzaStatus?.running}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Iniciar Servidor"
                    >
                      {wowzaControlLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">Iniciar</span>
                    </button>

                    <button
                      onClick={handleWowzaStop}
                      disabled={wowzaControlLoading}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Parar Servidor"
                    >
                      {wowzaControlLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">Parar</span>
                    </button>

                    <button
                      onClick={handleWowzaRestart}
                      disabled={wowzaControlLoading}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Reiniciar Servidor"
                    >
                      {wowzaControlLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">Reiniciar</span>
                    </button>
                  </div>
                </div>

                {/* Iniciar Playlist */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-200">
                  <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center">
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Playlist
                  </h3>
                  <select
                    value={selectedPlaylist}
                    onChange={(e) => setSelectedPlaylist(e.target.value)}
                    disabled={startingPlaylist || streamStatus?.is_live}
                    className="w-full px-3 py-2 mb-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecione uma playlist</option>
                    {playlists.map((playlist) => (
                      <option key={playlist.id} value={playlist.id.toString()}>
                        {playlist.nome} ({playlist.total_videos || 0} vídeos)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleStartPlaylist}
                    disabled={!selectedPlaylist || startingPlaylist || streamStatus?.is_live}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Iniciar transmissão da playlist selecionada"
                  >
                    {startingPlaylist ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {startingPlaylist ? 'Iniciando...' : 'Transmitir'}
                    </span>
                  </button>
                </div>

                {/* Botão Parar Stream - Separado e sempre ativo */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border-2 border-red-200">
                  <h3 className="text-sm font-bold text-red-900 mb-3 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Parar Transmissão
                  </h3>
                  <button
                    onClick={handleStopTransmission}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                    title="Parar Transmissão de Playlist"
                  >
                    <Square className="h-4 w-4" />
                    <span className="text-sm font-medium">Parar Playlist</span>
                  </button>
                </div>

                {/* Status da Transmissão */}
                {streamStatus?.is_live && (
                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                    <h4 className="text-xs font-bold text-red-900 mb-2 flex items-center">
                      <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse mr-2"></div>
                      TRANSMITINDO
                    </h4>
                    <div className="space-y-2 text-xs text-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Espectadores
                        </span>
                        <span className="font-bold">{streamStatus.transmission?.stats.viewers || streamStatus.obs_stream?.viewers || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Bitrate
                        </span>
                        <span className="font-bold">{streamStatus.transmission?.stats.bitrate || streamStatus.obs_stream?.bitrate || 0} kbps</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Tempo
                        </span>
                        <span className="font-bold">{streamStatus.transmission?.stats.uptime || streamStatus.obs_stream?.uptime || '00:00:00'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info da Transmissão - Abaixo do Player */}
            {streamStatus?.is_live && (
              <div className="p-5 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {streamStatus.stream_type === 'obs' ? 'TRANSMISSÃO OBS ATIVA' :
                       streamStatus.stream_type === 'playlist' ? 'PLAYLIST EM TRANSMISSÃO' :
                       'TRANSMISSÃO ATIVA'}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-700">
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>{streamStatus.transmission?.stats.viewers || streamStatus.obs_stream?.viewers || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Zap className="h-4 w-4" />
                      <span>{streamStatus.transmission?.stats.bitrate || streamStatus.obs_stream?.bitrate || 0} kbps</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{streamStatus.transmission?.stats.uptime || streamStatus.obs_stream?.uptime || '00:00:00'}</span>
                    </div>
                  </div>
                </div>

                {streamStatus.transmission && playlistName && streamStatus.stream_type === 'playlist' && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-gray-700 text-sm">
                      <strong className="text-gray-900">Playlist Atual:</strong> {playlistName.replace('📺 Playlist: ', '')}
                    </p>
                  </div>
                )}

                {streamStatus.stream_type === 'playlist' && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-gray-700 text-sm">
                      <strong className="text-gray-900">Modo Automático:</strong> Os vídeos são reproduzidos em sequência conforme configurado na playlist.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Ações Rápidas - Abaixo do Player */}
            <div className="p-6 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Ações Rápidas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <button
                onClick={() => window.location.href = '/dashboard/gerenciarvideos'}
                className="group flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all duration-200 border-2 border-transparent hover:border-blue-200"
                title="Gerenciar Vídeos"
              >
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-500 rounded-lg flex items-center justify-center mb-2 transition-colors">
                  <Video className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 text-center">Vídeos</span>
              </button>

              <button
                onClick={() => window.location.href = '/dashboard/espectadores'}
                className="group flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all duration-200 border-2 border-transparent hover:border-blue-200"
                title="Ver Espectadores"
              >
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-500 rounded-lg flex items-center justify-center mb-2 transition-colors">
                  <Users className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 text-center">Espectadores</span>
              </button>

              <button
                onClick={() => window.location.href = '/dashboard/playlists'}
                className="group flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all duration-200 border-2 border-transparent hover:border-blue-200"
                title="Gerenciar Playlists"
              >
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-500 rounded-lg flex items-center justify-center mb-2 transition-colors">
                  <Play className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 text-center">Playlists</span>
              </button>

              <button
                onClick={() => window.location.href = '/dashboard/players'}
                className="group flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all duration-200 border-2 border-transparent hover:border-blue-200"
                title="Players Externos"
              >
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-500 rounded-lg flex items-center justify-center mb-2 transition-colors">
                  <Monitor className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 text-center">Players</span>
              </button>

              <button
                onClick={() => window.location.href = '/dashboard/dados-conexao'}
                className="group flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all duration-200 border-2 border-transparent hover:border-blue-200"
                title="Dados de Conexão"
              >
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-500 rounded-lg flex items-center justify-center mb-2 transition-colors">
                  <Server className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 text-center">Conexão</span>
              </button>

              <button
                onClick={() => window.location.href = '/dashboard/configuracoes'}
                className="group flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all duration-200 border-2 border-transparent hover:border-blue-200"
                title="Configurações"
              >
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-500 rounded-lg flex items-center justify-center mb-2 transition-colors">
                  <Settings className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 text-center">Configurações</span>
              </button>
            </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Atividade Recente</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Sistema inicializado</span>
              <span className="text-xs text-gray-500 ml-auto">Agora</span>
            </div>
            
            {streamStatus?.is_live && (
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-700">Transmissão iniciada</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {streamStatus.transmission?.stats.uptime || streamStatus.obs_stream?.uptime}
                </span>
              </div>
            )}
            
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Usuário conectado</span>
              <span className="text-xs text-gray-500 ml-auto">Hoje</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;