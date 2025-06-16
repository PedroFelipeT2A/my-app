import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import VideoPlayer from '../../components/VideoPlayer';
import {
  Settings, Users, BarChart, FileVideo,
  PlayCircle, Play, Smartphone, RefreshCw,
  FolderPlus, Calendar, Youtube, Wifi, ArrowLeftRight, Megaphone
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Streaming Info Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <BarChart className="h-6 w-6 text-accent" />
              <h2 className="ml-2 text-xl font-semibold text-gray-800">Informações de Streaming</h2>
            </div>
          </div>
          <hr className="mb-4" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{user?.nome || 'Usuário'}</h3>
              <p className="text-gray-600">login</p>

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800">Servidor Principal</h3>
                <p className="text-gray-600">servidor</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800">{user?.espectadores || 0}</h3>
              <p className="text-gray-600">espectadores</p>

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800">{user?.bitrate || 0} kbps</h3>
                <p className="text-gray-600">bitrate</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800">{user?.espaco || 0} GB</h3>
              <p className="text-gray-600">espaço ftp</p>
            </div>
          </div>
        </div>

        {/* Video Player Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <FileVideo className="h-6 w-6 text-accent" />
              <h2 className="ml-2 text-xl font-semibold text-gray-800">Player</h2>
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
              <h2 className="ml-2 text-xl font-semibold text-gray-800">Gerenciamento do Streaming</h2>
            </div>
          </div>
          <hr className="mb-4" />

          <div className="grid grid-cols-3 gap-4">
            <Link to="/dashboard/dados-conexao" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Settings className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Dados de Conexão</span>
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
              <span className="text-sm text-gray-700 text-center">Espectadores Conectados</span>
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
              <span className="text-sm text-gray-700 text-center">Gravar Transmissão</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Smartphone className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">App Android</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Smartphone className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Fazer ao vivo usando smartphone</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <RefreshCw className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Pular vídeo</span>
            </div>
          </div>
        </div>

        {/* On-demand Management */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Wifi className="h-6 w-6 text-accent" />
              <h2 className="ml-2 text-xl font-semibold text-gray-800">Gerenciamento do Ondemand</h2>
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

            <Link to="/dashboard/gerenciarvideos"
              className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <FolderPlus className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Gerenciar Vídeos</span>
            </Link>

            <Link to="/dashboard/playlists" className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <FolderPlus className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Gerenciar Playlists</span>
            </Link>

            <Link
              to="/dashboard/agendamentos"
              className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Calendar className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Agendar Playlists</span>
            </Link>

            <Link
              to="/dashboard/comerciais"
              className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Megaphone className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Gerenciar Comerciais</span>
            </Link>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <Youtube className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Download Youtube</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="w-12 h-12 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full mb-2">
                <ArrowLeftRight className="h-6 w-6" />
              </div>
              <span className="text-sm text-gray-700 text-center">Relay RTMP/M3U8</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;