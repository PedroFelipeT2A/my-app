import React, { useState, useEffect } from 'react';
import { Play, Square, RotateCw, Lock, Unlock, Trash2, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

interface StreamingControlProps {
  login: string;
  onStatusChange?: () => void;
  showAdminControls?: boolean;
}

type StreamingStatus = 'ligado' | 'desligado' | 'aovivo' | 'manutencao' | 'erro';

const StreamingControl: React.FC<StreamingControlProps> = ({
  login,
  onStatusChange,
  showAdminControls = false
}) => {
  const [status, setStatus] = useState<StreamingStatus>('desligado');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [login]);

  const checkStatus = async () => {
    try {
      setChecking(true);
      const response = await api.get(`/streaming-control/status/${login}`);

      if (response.data.success) {
        setStatus(response.data.status);
      }
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      setStatus('erro');
    } finally {
      setChecking(false);
    }
  };

  const handleLigar = async () => {
    setLoading(true);
    try {
      const response = await api.post('/streaming-control/ligar', { login });

      if (response.data.success) {
        toast.success(response.data.message);
        await checkStatus();
        onStatusChange?.();
      } else if (response.data.alreadyActive) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao ligar streaming');
    } finally {
      setLoading(false);
    }
  };

  const handleDesligar = async () => {
    setLoading(true);
    try {
      const response = await api.post('/streaming-control/desligar', { login });

      if (response.data.success) {
        toast.success(response.data.message);
        await checkStatus();
        onStatusChange?.();
      } else if (response.data.alreadyInactive) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao desligar streaming');
    } finally {
      setLoading(false);
    }
  };

  const handleReiniciar = async () => {
    if (!confirm('Deseja realmente reiniciar o streaming?')) return;

    setLoading(true);
    try {
      const response = await api.post('/streaming-control/reiniciar', { login });

      if (response.data.success) {
        toast.success(response.data.message);
        await checkStatus();
        onStatusChange?.();
      } else {
        toast.error(response.data.message);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao reiniciar streaming');
    } finally {
      setLoading(false);
    }
  };

  const handleBloquear = async () => {
    if (!confirm('Deseja realmente bloquear este streaming?')) return;

    setLoading(true);
    try {
      const response = await api.post('/streaming-control/bloquear', { login });

      if (response.data.success) {
        toast.success(response.data.message);
        await checkStatus();
        onStatusChange?.();
      } else {
        toast.error(response.data.message);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao bloquear streaming');
    } finally {
      setLoading(false);
    }
  };

  const handleDesbloquear = async () => {
    if (!confirm('Deseja realmente desbloquear este streaming?')) return;

    setLoading(true);
    try {
      const response = await api.post('/streaming-control/desbloquear', { login });

      if (response.data.success) {
        toast.success(response.data.message);
        await checkStatus();
        onStatusChange?.();
      } else {
        toast.error(response.data.message);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao desbloquear streaming');
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async () => {
    if (!confirm('ATENÇÃO! Esta ação irá remover permanentemente o streaming e todos os dados associados. Deseja continuar?')) return;
    if (!confirm('Tem certeza absoluta? Esta ação não pode ser desfeita!')) return;

    setLoading(true);
    try {
      const response = await api.delete('/streaming-control/remover', {
        data: { login }
      });

      if (response.data.success) {
        toast.success(response.data.message);
        onStatusChange?.();
      } else {
        toast.error(response.data.message);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao remover streaming');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'aovivo': return 'bg-red-500';
      case 'ligado': return 'bg-green-500';
      case 'desligado': return 'bg-gray-500';
      case 'manutencao': return 'bg-yellow-500';
      case 'erro': return 'bg-red-700';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'aovivo': return 'Ao Vivo';
      case 'ligado': return 'Ligado';
      case 'desligado': return 'Desligado';
      case 'manutencao': return 'Manutenção';
      case 'erro': return 'Erro';
      default: return 'Verificando...';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">
            Controle de Streaming
          </h3>
          {checking && (
            <Loader className="w-4 h-4 animate-spin text-blue-600" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
          <span className="text-sm font-medium text-gray-700">
            {getStatusText()}
          </span>
        </div>
      </div>

      {status === 'manutencao' && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Servidor em Manutenção</p>
            <p className="text-sm text-yellow-700 mt-1">
              O servidor está temporariamente indisponível. Tente novamente mais tarde.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleLigar}
            disabled={loading || status === 'manutencao' || status === 'ligado' || status === 'aovivo'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            <span className="font-medium">Ligar</span>
          </button>

          <button
            onClick={handleDesligar}
            disabled={loading || status === 'manutencao' || status === 'desligado'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            <span className="font-medium">Desligar</span>
          </button>
        </div>

        <button
          onClick={handleReiniciar}
          disabled={loading || status === 'manutencao'}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <RotateCw className="w-5 h-5" />
          )}
          <span className="font-medium">Reiniciar</span>
        </button>

        {showAdminControls && (
          <>
            <div className="border-t border-gray-200 my-4" />

            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Controles de Administrador
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleBloquear}
                  disabled={loading || status === 'manutencao'}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-4 h-4" />
                  <span className="text-sm font-medium">Bloquear</span>
                </button>

                <button
                  onClick={handleDesbloquear}
                  disabled={loading || status === 'manutencao'}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Unlock className="w-4 h-4" />
                  <span className="text-sm font-medium">Desbloquear</span>
                </button>
              </div>

              <button
                onClick={handleRemover}
                disabled={loading || status === 'manutencao'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">Remover Streaming</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Status atualizado automaticamente a cada 10 segundos
        </p>
      </div>
    </div>
  );
};

export default StreamingControl;