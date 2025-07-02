import React, { useState, useEffect } from 'react';
import { Play, Square, Activity, Users, Wifi, Server, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

interface Playlist {
  id: number;
  nome: string;
  quantidadeVideos?: number;
  duracaoTotal?: number;
}

interface Server {
  id: string;
  nome: string;
  nome_principal?: string;
  ip: string;
}

interface StreamStats {
  isActive: boolean;
  viewers: number;
  bitrate: number;
  uptime: string;
  currentVideo?: number;
  totalVideos?: number;
}

interface ActiveStream {
  id: string;
  is_live: boolean;
  viewers: number;
  bitrate: number;
  uptime: string;
  created_at: string;
  servers?: {
    nome: string;
    ip: string;
  };
}

const StreamingControl: React.FC = () => {
  const { getToken } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStats, setStreamStats] = useState<StreamStats>({
    isActive: false,
    viewers: 0,
    bitrate: 0,
    uptime: '00:00:00'
  });
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [wowzaConnected, setWowzaConnected] = useState<boolean | null>(null);

  useEffect(() => {
    loadInitialData();
    checkStreamStatus();
    testWowzaConnection();
    
    // Atualizar estatísticas a cada 30 segundos
    const interval = setInterval(() => {
      if (isStreaming) {
        checkStreamStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    try {
      const token = await getToken();
      
      // Carregar playlists
      const playlistsResponse = await fetch('/api/playlists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const playlistsData = await playlistsResponse.json();
      setPlaylists(playlistsData);

      // Carregar servidores
      const serversResponse = await fetch('/api/servers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const serversData = await serversResponse.json();
      setServers(serversData);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados iniciais');
    }
  };

  const testWowzaConnection = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/wowza/test-connection', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      setWowzaConnected(result.connected);
      
      if (!result.connected) {
        toast.warning('Conexão com Wowza não estabelecida');
      }
    } catch (error) {
      console.error('Erro ao testar conexão Wowza:', error);
      setWowzaConnected(false);
    }
  };

  const checkStreamStatus = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      
      setIsStreaming(result.isLive);
      setActiveStream(result.stream);
      
      if (result.stats) {
        setStreamStats(result.stats);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const startStreaming = async () => {
    if (!selectedPlaylist) {
      toast.error('Selecione uma playlist para iniciar a transmissão');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          playlistId: selectedPlaylist,
          serverId: selectedServer || null
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Transmissão iniciada com sucesso!');
        setIsStreaming(true);
        setActiveStream(result.stream);
        checkStreamStatus();
      } else {
        toast.error(result.error || 'Erro ao iniciar transmissão');
      }
    } catch (error) {
      console.error('Erro ao iniciar transmissão:', error);
      toast.error('Erro ao iniciar transmissão');
    } finally {
      setLoading(false);
    }
  };

  const stopStreaming = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          streamId: activeStream?.id
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Transmissão parada com sucesso!');
        setIsStreaming(false);
        setActiveStream(null);
        setStreamStats({
          isActive: false,
          viewers: 0,
          bitrate: 0,
          uptime: '00:00:00'
        });
      } else {
        toast.error(result.error || 'Erro ao parar transmissão');
      }
    } catch (error) {
      console.error('Erro ao parar transmissão:', error);
      toast.error('Erro ao parar transmissão');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Controle de Transmissão</h1>
        
        {/* Status da conexão Wowza */}
        <div className="flex items-center space-x-2">
          {wowzaConnected === null ? (
            <div className="flex items-center text-gray-500">
              <Activity className="h-4 w-4 mr-1 animate-pulse" />
              <span className="text-sm">Verificando conexão...</span>
            </div>
          ) : wowzaConnected ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span className="text-sm">Wowza Conectado</span>
            </div>
          ) : (
            <div className="flex items-center text-red-600">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span className="text-sm">Wowza Desconectado</span>
            </div>
          )}
        </div>
      </div>

      {/* Status da transmissão atual */}
      {isStreaming && activeStream && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse mr-3"></div>
              <h2 className="text-lg font-semibold text-green-800">TRANSMISSÃO AO VIVO</h2>
            </div>
            <button
              onClick={stopStreaming}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
            >
              <Square className="h-4 w-4 mr-2" />
              {loading ? 'Parando...' : 'Parar Transmissão'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-md">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Espectadores</p>
                  <p className="text-xl font-bold">{streamStats.viewers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-md">
              <div className="flex items-center">
                <Activity className="h-5 w-5 text-green-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Bitrate</p>
                  <p className="text-xl font-bold">{streamStats.bitrate} kbps</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-md">
              <div className="flex items-center">
                <Wifi className="h-5 w-5 text-purple-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Tempo Ativo</p>
                  <p className="text-xl font-bold">{streamStats.uptime}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-md">
              <div className="flex items-center">
                <Play className="h-5 w-5 text-orange-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Vídeo Atual</p>
                  <p className="text-xl font-bold">
                    {streamStats.currentVideo || 1} / {streamStats.totalVideos || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {activeStream.servers && (
            <div className="mt-4 p-3 bg-white rounded-md">
              <p className="text-sm text-gray-600">
                Servidor: <span className="font-medium">{activeStream.servers.nome}</span> 
                ({activeStream.servers.ip})
              </p>
            </div>
          )}
        </div>
      )}

      {/* Controles de transmissão */}
      {!isStreaming && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Iniciar Nova Transmissão</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="playlist" className="block text-sm font-medium text-gray-700 mb-2">
                Selecionar Playlist *
              </label>
              <select
                id="playlist"
                value={selectedPlaylist}
                onChange={(e) => setSelectedPlaylist(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Escolha uma playlist...</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.nome} ({playlist.quantidadeVideos || 0} vídeos)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="server" className="block text-sm font-medium text-gray-700 mb-2">
                Servidor (Opcional)
              </label>
              <select
                id="server"
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Servidor padrão</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.nome} ({server.ip})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={startStreaming}
              disabled={loading || !selectedPlaylist || !wowzaConnected}
              className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Play className="h-5 w-5 mr-2" />
              {loading ? 'Iniciando...' : 'Iniciar Transmissão'}
            </button>
          </div>

          {!wowzaConnected && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                <p className="text-sm text-yellow-800">
                  Conexão com o servidor Wowza não estabelecida. Verifique a configuração do servidor.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Informações de conexão */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Informações de Conexão</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Servidor Wowza</h3>
            <div className="bg-gray-100 p-3 rounded-md">
              <p className="font-mono text-sm">51.222.156.223</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Status da Conexão</h3>
            <div className="bg-gray-100 p-3 rounded-md">
              <div className="flex items-center">
                <div className={`h-2 w-2 rounded-full mr-2 ${wowzaConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{wowzaConnected ? 'Conectado' : 'Desconectado'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={testWowzaConnection}
            className="text-primary-600 hover:text-primary-800 text-sm flex items-center"
          >
            <Server className="h-4 w-4 mr-1" />
            Testar Conexão
          </button>
        </div>
      </div>
    </div>
  );
};

export default StreamingControl;