import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStream } from '../../context/StreamContext';
import VideoPlayer from '../../components/VideoPlayer';
import {
  Settings, Users, BarChart, FileVideo,
  PlayCircle, Play, Smartphone, RefreshCw,
  FolderPlus, Calendar, Youtube, Wifi, ArrowLeftRight, 
  Megaphone, Radio, Activity, Clock, Eye, Zap
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { streamData } = useStream();

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const connectedPlatforms = streamData.platforms.filter(p => p.status === 'connected');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        
        {streamData.isLive && (
          <div className="px-4 py-2 rounded-full flex items-center space-x-2 bg-green-100 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">Transmissão Ativa</span>
          </div>
        )}
      </div>

      {/* Stream Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Eye className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Espectadores</p>
              <p className="text-2xl font-bold text-gray-900">{streamData.viewers}</p>
              <p className="text-xs text-gray-400">Em tempo real</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Bitrate</p>
              <p className="text-2xl font-bold text-gray-900">{streamData.bitrate}</p>
              <p className="text-xs text-gray-400">kbps</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Duração</p>
              <p className="text-2xl font-bold text-gray-900">{streamData.uptime}</p>
              <p className="text-xs text-gray-400">Tempo online</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Radio className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Plataformas</p>
              <p className="text-2xl font-bold text-gray-900">{connectedPlatforms.length}</p>
              <p className="text-xs text-gray-400">Conectadas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Platforms */}
      {streamData.isLive && connectedPlatforms.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Plataformas Conectadas</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {connectedPlatforms.map((platform) => (
              <div key={platform.id} className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">{platform.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Info Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <BarChart className="h-6 w-6 text-accent" />
              <h2 className="ml-2 text-xl font-semibold text-gray-800">Informações do Usuário</h2>
            </div>
          </div>
          <hr className="mb-4" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{user?.nome || 'Usuário'}</h3>
              <p className="text-gray-600">login</p>

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800">Sistema</h3>
                <p className="text-gray-600">Streaming Manager</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800">{streamData.viewers}</h3>
              <p className="text-gray-600">espectadores ativos</p>

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800">{streamData.bitrate} kbps</h3>
                <p className="text-gray-600">bitrate atual</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800">{user?.espaco || 0} GB</h3>
              <p className="text-gray-600">espaço disponível</p>

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800">{streamData.uptime}</h3>
                <p className="text-gray-600">tempo online</p>
              </div>
            </div>
          </div>
        </div>

        {/* Video Player Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <FileVideo className="h-6 w-6 text-accent" />
              <h2 className="ml-2 text-xl font-semibold text-gray-800">Player de Transmissão</h2>
            </div>
          </div>
          <hr className="mb-4" />

          <VideoPlayer />
        </div>
      </div>

      {/* Management Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Streaming Management */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Play className="h-6 w-6 text-accent" />
              <h2 className="ml-2 text-xl font-semibold text-gray-800">Gerenciamento de Transmissão</h2>
            </div>
          </div>
          <hr className="mb-4" />

          <div className="grid grid-cols-3 gap-4">
            <Link to="/dashboard/iniciar-transmissao" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-green-100 text-green-600 rounded-full mb-2">
                <Radio className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Iniciar Transmissão</span>
            </Link>

            <Link to="/dashboard/dados-conexao" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Settings className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Dados Conexão</span>
            </Link>

            <Link to="/dashboard/configuracoes" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Settings className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Configurações</span>
            </Link>

            <Link to="/dashboard/players" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <PlayCircle className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Players</span>
            </Link>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Users className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Espectadores</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <BarChart className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Estatísticas</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Settings className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Gravar Stream</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Smartphone className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">App Mobile</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <RefreshCw className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Controles</span>
            </div>
          </div>
        </div>

        {/* On-demand Management */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Wifi className="h-6 w-6 text-accent" />
              <h2 className="ml-2 text-xl font-semibold text-gray-800">Gerenciamento de Conteúdo</h2>
            </div>
          </div>
          <hr className="mb-4" />

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <PlayCircle className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Iniciar Playlist</span>
            </div>

            <Link to="/dashboard/gerenciarvideos" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <FolderPlus className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Gerenciar Vídeos</span>
            </Link>

            <Link to="/dashboard/playlists" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <FolderPlus className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Playlists</span>
            </Link>

            <Link to="/dashboard/agendamentos" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Calendar className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Agendamentos</span>
            </Link>

            <Link to="/dashboard/comerciais" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Megaphone className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Comerciais</span>
            </Link>

            <Link to="/dashboard/downloadyoutube" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Youtube className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Download YouTube</span>
            </Link>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <ArrowLeftRight className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Relay RTMP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;