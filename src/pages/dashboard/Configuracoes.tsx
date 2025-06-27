import React, { useState } from 'react';
import { ChevronLeft, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const Configuracoes: React.FC = () => {
  const [formData, setFormData] = useState({
    streamTitle: 'Minha Transmissão',
    description: 'Descrição da minha transmissão ao vivo',
    playerWidth: '100%',
    playerHeight: '500px',
    autoplay: true,
    showControls: true,
    muted: false,
    logoUrl: '',
    logoPosition: 'top-right',
    allowDownload: false,
    enableChat: true,
    chatDelay: 3,
    requireLogin: false,
    lowLatency: true
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData({
        ...formData,
        [name]: target.checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This would normally save to an API
    toast.success('Configurações salvas com sucesso!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <Link to="/dashboard" className="flex items-center text-primary-600 hover:text-primary-800">
          <ChevronLeft className="h-5 w-5 mr-1" />
          <span>Voltar ao Dashboard</span>
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Configurações Gerais</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="streamTitle" className="block text-sm font-medium text-gray-700 mb-1">
                Título da Transmissão
              </label>
              <input
                id="streamTitle"
                name="streamTitle"
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={formData.streamTitle}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Configurações do Player</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="playerWidth" className="block text-sm font-medium text-gray-700 mb-1">
                Largura do Player
              </label>
              <input
                id="playerWidth"
                name="playerWidth"
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={formData.playerWidth}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="playerHeight" className="block text-sm font-medium text-gray-700 mb-1">
                Altura do Player
              </label>
              <input
                id="playerHeight"
                name="playerHeight"
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={formData.playerHeight}
                onChange={handleChange}
              />
            </div>
            
            <div className="flex items-center">
              <input
                id="autoplay"
                name="autoplay"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={formData.autoplay}
                onChange={handleChange}
              />
              <label htmlFor="autoplay" className="ml-2 block text-sm text-gray-700">
                Reprodução Automática
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="showControls"
                name="showControls"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={formData.showControls}
                onChange={handleChange}
              />
              <label htmlFor="showControls" className="ml-2 block text-sm text-gray-700">
                Mostrar Controles
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="muted"
                name="muted"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={formData.muted}
                onChange={handleChange}
              />
              <label htmlFor="muted" className="ml-2 block text-sm text-gray-700">
                Iniciar Mudo
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="lowLatency"
                name="lowLatency"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={formData.lowLatency}
                onChange={handleChange}
              />
              <label htmlFor="lowLatency" className="ml-2 block text-sm text-gray-700">
                Modo de Baixa Latência
              </label>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Configurações de Logo</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-1">
                URL da Logo
              </label>
              <input
                id="logoUrl"
                name="logoUrl"
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={formData.logoUrl}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="logoPosition" className="block text-sm font-medium text-gray-700 mb-1">
                Posição da Logo
              </label>
              <select
                id="logoPosition"
                name="logoPosition"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={formData.logoPosition}
                onChange={handleChange}
              >
                <option value="top-left">Superior Esquerdo</option>
                <option value="top-right">Superior Direito</option>
                <option value="bottom-left">Inferior Esquerdo</option>
                <option value="bottom-right">Inferior Direito</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Configurações de Chat</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center">
              <input
                id="enableChat"
                name="enableChat"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={formData.enableChat}
                onChange={handleChange}
              />
              <label htmlFor="enableChat" className="ml-2 block text-sm text-gray-700">
                Habilitar Chat
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="requireLogin"
                name="requireLogin"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                checked={formData.requireLogin}
                onChange={handleChange}
              />
              <label htmlFor="requireLogin" className="ml-2 block text-sm text-gray-700">
                Exigir Login para Chat
              </label>
            </div>
            
            <div>
              <label htmlFor="chatDelay" className="block text-sm font-medium text-gray-700 mb-1">
                Atraso do Chat (segundos)
              </label>
              <input
                id="chatDelay"
                name="chatDelay"
                type="number"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={formData.chatDelay}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center"
          >
            <Save className="h-5 w-5 mr-2" />
            Salvar Configurações
          </button>
        </div>
      </form>
    </div>
  );
};

export default Configuracoes;