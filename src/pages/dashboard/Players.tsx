import React, { useState } from 'react';
import { ChevronLeft, Copy, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const Players: React.FC = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<string>('iframe');
  
  const embedCodes = {
    iframe: `<iframe 
  src="https://servidor.exemplo.com/player/embed/?stream=meustreamid" 
  width="100%" 
  height="400" 
  frameborder="0" 
  allowfullscreen>
</iframe>`,
    javascript: `<div id="player"></div>
<script src="https://servidor.exemplo.com/player/js/jwplayer.js"></script>
<script>
  jwplayer("player").setup({
    file: "https://servidor.exemplo.com/live/playlist.m3u8",
    width: "100%",
    height: 400,
    autostart: true
  });
</script>`,
    html5: `<video width="100%" height="400" controls autoplay>
  <source src="https://servidor.exemplo.com/live/playlist.m3u8" type="application/x-mpegURL">
  Seu navegador não suporta o elemento de vídeo.
</video>`,
    wordpress: `[streaming_player url="https://servidor.exemplo.com/live/playlist.m3u8" width="100%" height="400" autoplay="true"]`,
    react: `import React from 'react';

const StreamPlayer = () => {
  return (
    <iframe 
      src="https://servidor.exemplo.com/player/embed/?stream=meustreamid"
      width="100%" 
      height="400" 
      frameBorder="0" 
      allowFullScreen
    />
  );
};

export default StreamPlayer;`
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCodes[selectedPlayer as keyof typeof embedCodes]);
    toast.success('Código copiado para a área de transferência!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <Link to="/dashboard" className="flex items-center text-primary-600 hover:text-primary-800">
          <ChevronLeft className="h-5 w-5 mr-1" />
          <span>Voltar ao Dashboard</span>
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Players</h1>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Opções de Player</h2>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="playerType" className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o tipo de player:
            </label>
            <select
              id="playerType"
              className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
            >
              <option value="iframe">iFrame (Recomendado)</option>
              <option value="javascript">JavaScript (JW Player)</option>
              <option value="html5">HTML5 Video</option>
              <option value="wordpress">WordPress Shortcode</option>
              <option value="react">React Component</option>
            </select>
          </div>
          
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Código de Incorporação</span>
              <button
                className="text-primary-600 hover:text-primary-800 flex items-center text-sm"
                onClick={handleCopyCode}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </button>
            </div>
            <div className="bg-gray-900 p-4 overflow-x-auto">
              <pre className="text-gray-100 font-mono text-sm whitespace-pre-wrap">
                {embedCodes[selectedPlayer as keyof typeof embedCodes]}
              </pre>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-lg font-medium text-gray-800 mb-2">Preview</h3>
            <div className="bg-white border border-gray-200 rounded-md p-4 aspect-video flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-400 mb-2">Preview do player aparecerá aqui</div>
                <a 
                  href="https://servidor.exemplo.com/player/embed/?stream=meustreamid" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-800 flex items-center justify-center text-sm"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Abrir em nova janela
                </a>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-lg font-medium text-gray-800 mb-2">Instruções</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Selecione o tipo de player que deseja utilizar</li>
              <li>Copie o código de incorporação</li>
              <li>Cole o código em seu site ou aplicação</li>
              <li>Ajuste a largura e altura conforme necessário</li>
              <li>Para personalizar ainda mais o player, acesse a seção de Configurações</li>
            </ol>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">URLs Diretas</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">URL HLS (M3U8)</h3>
            <div className="mt-1 flex items-center">
              <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full">
                https://servidor.exemplo.com/live/playlist.m3u8
              </span>
              <button 
                className="ml-2 text-primary-600 hover:text-primary-800"
                onClick={() => {
                  navigator.clipboard.writeText('https://servidor.exemplo.com/live/playlist.m3u8');
                  toast.success('URL copiada para a área de transferência!');
                }}
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">URL de Compartilhamento</h3>
            <div className="mt-1 flex items-center">
              <span className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-md w-full">
                https://servidor.exemplo.com/watch?id=meustreamid
              </span>
              <button 
                className="ml-2 text-primary-600 hover:text-primary-800"
                onClick={() => {
                  navigator.clipboard.writeText('https://servidor.exemplo.com/watch?id=meustreamid');
                  toast.success('URL copiada para a área de transferência!');
                }}
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Players;