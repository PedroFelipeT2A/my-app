import React from 'react';
import { Monitor, Wifi, Play, Settings } from 'lucide-react';

interface PlayerType {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  features: string[];
  compatibility: string[];
  recommended: boolean;
  technology: string;
}

interface StreamingPlayerSelectorProps {
  selectedPlayer: string;
  onPlayerChange: (playerId: string) => void;
  className?: string;
}

const StreamingPlayerSelector: React.FC<StreamingPlayerSelectorProps> = ({
  selectedPlayer,
  onPlayerChange,
  className = ''
}) => {
  const playerTypes: PlayerType[] = [
    {
      id: 'videojs',
      name: 'Video.js',
      description: 'Player profissional com suporte HLS nativo e plugins avançados',
      icon: Monitor,
      features: ['HLS Nativo', 'Controles Avançados', 'Plugins', 'Qualidade Adaptativa', 'Watermark'],
      compatibility: ['Chrome', 'Firefox', 'Safari', 'Edge', 'Mobile', 'Smart TV'],
      recommended: true,
      technology: 'HTML5 + HLS.js'
    },
    {
      id: 'hlsjs',
      name: 'HLS.js',
      description: 'Player leve especializado em streaming HLS/M3U8',
      icon: Wifi,
      features: ['HLS Especializado', 'Baixa Latência', 'Auto-reconexão', 'Leve', 'Rápido'],
      compatibility: ['Chrome', 'Firefox', 'Edge', 'Mobile'],
      recommended: false,
      technology: 'HLS.js Puro'
    },
    {
      id: 'clappr',
      name: 'Clappr',
      description: 'Player brasileiro moderno e extensível',
      icon: Play,
      features: ['Moderno', 'Extensível', 'Level Selector', 'Brasileiro', 'Responsivo'],
      compatibility: ['Navegadores modernos', 'Mobile'],
      recommended: false,
      technology: 'Clappr Framework'
    }
  ];

  const selectedPlayerData = playerTypes.find(p => p.id === selectedPlayer);

  return (
    <div className={`streaming-player-selector ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Tipo de Player para Streaming</h3>
        <p className="text-sm text-gray-600">
          Escolha o player mais adequado para suas transmissões HLS/M3U8
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {playerTypes.map((player) => (
          <div
            key={player.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedPlayer === player.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onPlayerChange(player.id)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <player.icon className={`h-6 w-6 ${
                  selectedPlayer === player.id ? 'text-primary-600' : 'text-gray-600'
                }`} />
                <h4 className="font-medium text-gray-900">{player.name}</h4>
              </div>
              
              <div className="flex items-center space-x-1">
                {player.recommended && (
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                    Recomendado
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-3">{player.description}</p>

            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-gray-500">Tecnologia:</span>
                <div className="text-xs text-blue-600 font-medium mt-1">
                  {player.technology}
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500">Recursos principais:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {player.features.slice(0, 3).map((feature, index) => (
                    <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                      {feature}
                    </span>
                  ))}
                  {player.features.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{player.features.length - 3} mais
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500">Compatibilidade:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {player.compatibility.slice(0, 3).map((compat, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {compat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Informações do Player Selecionado */}
      {selectedPlayerData && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <selectedPlayerData.icon className="h-5 w-5 text-blue-600" />
            <h4 className="font-medium text-blue-900">{selectedPlayerData.name} Selecionado</h4>
          </div>
          <p className="text-blue-800 text-sm mb-3">{selectedPlayerData.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-900">Todos os recursos:</span>
              <ul className="text-blue-800 mt-1 space-y-1">
                {selectedPlayerData.features.map((feature, index) => (
                  <li key={index}>• {feature}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <span className="font-medium text-blue-900">Compatibilidade completa:</span>
              <ul className="text-blue-800 mt-1 space-y-1">
                {selectedPlayerData.compatibility.map((compat, index) => (
                  <li key={index}>• {compat}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 p-3 bg-blue-100 rounded-md">
            <p className="text-blue-900 text-sm">
              <strong>🚀 Tecnologia:</strong> {selectedPlayerData.technology} - 
              Otimizado para transmissões HLS/M3U8 com suporte a streaming adaptativo e 
              reconexão automática para máxima estabilidade.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamingPlayerSelector;