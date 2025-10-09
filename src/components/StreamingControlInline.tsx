import React, { useState, useEffect } from 'react';
import { Play, Square, RotateCw, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

interface StreamingControlInlineProps {
  login: string;
  onStatusChange?: () => void;
  compact?: boolean;
}

type StreamingStatus = 'ligado' | 'desligado' | 'aovivo' | 'manutencao' | 'erro';

const StreamingControlInline: React.FC<StreamingControlInlineProps> = ({
  login,
  onStatusChange,
  compact = false
}) => {
  const [status, setStatus] = useState<StreamingStatus>('desligado');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [login]);

  const checkStatus = async () => {
    try {
      setChecking(true);
      const response = await api.get(`/streaming-control/status/${login}`);

      if (response.data.success) {
        setStatus(response.data.status);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setStatus('erro');
    } finally {
      setChecking(false);
    }
  };

  const handleAction = async (action: 'ligar' | 'desligar' | 'reiniciar') => {
    setLoading(true);
    try {
      const response = await api.post(`/streaming-control/${action}`, { login });

      if (response.data.success) {
        toast.success(response.data.message);
        await checkStatus();
        onStatusChange?.();
      } else {
        toast.error(response.data.message);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Erro ao ${action} streaming`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'aovivo': return 'bg-red-500';
      case 'ligado': return 'bg-green-500';
      case 'desligado': return 'bg-gray-400';
      case 'manutencao': return 'bg-yellow-500';
      case 'erro': return 'bg-red-700';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'aovivo': return 'Ao Vivo';
      case 'ligado': return 'Ligado';
      case 'desligado': return 'Desligado';
      case 'manutencao': return 'Manutenção';
      case 'erro': return 'Erro';
      default: return '...';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-xs text-gray-600">{getStatusText()}</span>

        {status !== 'manutencao' && (
          <div className="flex items-center gap-1 ml-2">
            {status === 'desligado' ? (
              <button
                onClick={() => handleAction('ligar')}
                disabled={loading}
                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                title="Ligar"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              </button>
            ) : (
              <button
                onClick={() => handleAction('desligar')}
                disabled={loading}
                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Desligar"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
        <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
      </div>

      {status !== 'manutencao' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAction('ligar')}
            disabled={loading || status === 'ligado' || status === 'aovivo'}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>Ligar</span>
          </button>

          <button
            onClick={() => handleAction('desligar')}
            disabled={loading || status === 'desligado'}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            <span>Desligar</span>
          </button>

          <button
            onClick={() => handleAction('reiniciar')}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            <span>Reiniciar</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default StreamingControlInline;