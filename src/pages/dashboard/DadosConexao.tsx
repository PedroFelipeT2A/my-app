import React from 'react';
import { ChevronLeft, Copy, Server, Wifi, Settings, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const DadosConexao: React.FC = () => {
  const { user } = useAuth();
  
  const userLogin = user?.email?.split('@')[0] || 'usuario';
  
  // Dados de conexão para OBS/Streamlabs (sem expor dados do Wowza)
  const connectionData = {
    serverUrl: 'streaming.exemplo.com',
    port: '1935',
    application: 'live',
    streamName: `${userLogin}_stream`,
    rtmpUrl: `rtmp://streaming.exemplo.com:1935/live`,
    streamKey: `${userLogin}_${Date.now()}`,
    hlsUrl: `https://streaming.exemplo.com/live/${userLogin}_stream/playlist.m3u8`
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <Link to="/dashboard" className="flex items-center text-primary-600 hover:text-primary-800">
          <ChevronLeft className="h-5 w-5 mr-1" />
          <span>Voltar ao Dashboard</span>
        </Link>
      </div>

      <div className="flex items-center space-x-3">
        <Server className="h-8 w-8 text-primary-600" />
        <h1 className="text-3xl font-bold text-gray-900">Dados de Conexão</h1>
      </div>

      {/* Informações do Servidor */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="h-6 w-6 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-800">Informações do Servidor</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Servidor de Streaming</h3>
              <div className="mt-1 flex items-center">
                <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full">
                  {connectionData.serverUrl}
                </span>
                <button 
                  className="ml-2 text-primary-600 hover:text-primary-800"
                  onClick={() => copyToClipboard(connectionData.serverUrl, 'Servidor')}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Porta RTMP</h3>
              <div className="mt-1 flex items-center">
                <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full">
                  {connectionData.port}
                </span>
                <button 
                  className="ml-2 text-primary-600 hover:text-primary-800"
                  onClick={() => copyToClipboard(connectionData.port, 'Porta')}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Aplicação</h3>
              <div className="mt-1 flex items-center">
                <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full">
                  {connectionData.application}
                </span>
                <button 
                  className="ml-2 text-primary-600 hover:text-primary-800"
                  onClick={() => copyToClipboard(connectionData.application, 'Aplicação')}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Nome do Stream</h3>
              <div className="mt-1 flex items-center">
                <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full">
                  {connectionData.streamName}
                </span>
                <button 
                  className="ml-2 text-primary-600 hover:text-primary-800"
                  onClick={() => copyToClipboard(connectionData.streamName, 'Nome do Stream')}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Chave de Transmissão</h3>
              <div className="mt-1 flex items-center">
                <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full">
                  {connectionData.streamKey}
                </span>
                <button 
                  className="ml-2 text-primary-600 hover:text-primary-800"
                  onClick={() => copyToClipboard(connectionData.streamKey, 'Chave de Transmissão')}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <div className="mt-1 flex items-center">
                <span className="text-gray-900 bg-green-100 text-green-800 px-3 py-2 rounded-md w-full">
                  Servidor Online
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* URLs de Transmissão */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Wifi className="h-6 w-6 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-800">URLs de Transmissão</h2>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">URL do Servidor (Para OBS/Streamlabs)</h3>
            <div className="mt-1 flex items-center">
              <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full text-sm">
                {connectionData.rtmpUrl}
              </span>
              <button 
                className="ml-2 text-primary-600 hover:text-primary-800"
                onClick={() => copyToClipboard(connectionData.rtmpUrl, 'URL do Servidor')}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Chave de Transmissão (Stream Key)</h3>
            <div className="mt-1 flex items-center">
              <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full text-sm">
                {connectionData.streamKey}
              </span>
              <button 
                className="ml-2 text-primary-600 hover:text-primary-800"
                onClick={() => copyToClipboard(connectionData.streamKey, 'Chave de Transmissão')}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">URL de Visualização (HLS)</h3>
            <div className="mt-1 flex items-center">
              <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full text-sm">
                {connectionData.hlsUrl}
              </span>
              <button 
                className="ml-2 text-primary-600 hover:text-primary-800"
                onClick={() => copyToClipboard(connectionData.hlsUrl, 'URL de Visualização')}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Configurações Recomendadas */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="h-6 w-6 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-800">Configurações Recomendadas</h2>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">OBS Studio</h3>
            <p className="text-gray-600 mb-4">Configurações recomendadas para transmissão com OBS Studio</p>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Servidor: <span className="font-medium font-mono">{connectionData.rtmpUrl}</span></li>
                <li>Chave de transmissão: <span className="font-medium font-mono">{connectionData.streamKey}</span></li>
                <li>Taxa de bits de vídeo: <span className="font-medium">2500-5000 Kbps</span></li>
                <li>Taxa de bits de áudio: <span className="font-medium">128-320 Kbps</span></li>
                <li>Resolução: <span className="font-medium">1920x1080 (1080p) ou 1280x720 (720p)</span></li>
                <li>FPS: <span className="font-medium">30 ou 60</span></li>
                <li>Preset de codificação: <span className="font-medium">veryfast ou fast</span></li>
                <li>Perfil: <span className="font-medium">main ou high</span></li>
              </ul>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Streamlabs</h3>
            <p className="text-gray-600 mb-4">Configurações recomendadas para transmissão com Streamlabs</p>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Servidor: <span className="font-medium font-mono">{connectionData.rtmpUrl}</span></li>
                <li>Chave de transmissão: <span className="font-medium font-mono">{connectionData.streamKey}</span></li>
                <li>Taxa de bits de vídeo: <span className="font-medium">2500-5000 Kbps</span></li>
                <li>Taxa de bits de áudio: <span className="font-medium">128-320 Kbps</span></li>
                <li>Resolução: <span className="font-medium">1920x1080 (1080p) ou 1280x720 (720p)</span></li>
                <li>FPS: <span className="font-medium">30 ou 60</span></li>
                <li>Preset de codificação: <span className="font-medium">veryfast ou fast</span></li>
                <li>Perfil: <span className="font-medium">main ou high</span></li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Qualidade de Transmissão</h3>
            <p className="text-gray-600 mb-4">Configurações baseadas na sua conexão de internet</p>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <h4 className="font-medium text-gray-800">Básica</h4>
                  <p className="text-sm text-gray-600">720p @ 30fps</p>
                  <p className="text-sm text-gray-600">1500-2500 Kbps</p>
                </div>
                <div className="text-center">
                  <h4 className="font-medium text-gray-800">Boa</h4>
                  <p className="text-sm text-gray-600">1080p @ 30fps</p>
                  <p className="text-sm text-gray-600">2500-4000 Kbps</p>
                </div>
                <div className="text-center">
                  <h4 className="font-medium text-gray-800">Excelente</h4>
                  <p className="text-sm text-gray-600">1080p @ 60fps</p>
                  <p className="text-sm text-gray-600">4000-6000 Kbps</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Informações Importantes */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Instruções de Uso</h3>
        <div className="space-y-2 text-blue-800">
          <p>• Configure seu OBS/Streamlabs com os dados acima</p>
          <p>• Inicie a transmissão no seu software primeiro</p>
          <p>• Em seguida, configure as plataformas desejadas na seção "Iniciar Transmissão"</p>
          <p>• O sistema irá distribuir automaticamente para todas as plataformas configuradas</p>
          <p>• Monitore as estatísticas em tempo real no dashboard</p>
        </div>
      </div>
    </div>
  );
};

export default DadosConexao;