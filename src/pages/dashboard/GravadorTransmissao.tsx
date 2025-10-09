import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Circle, Square, Clock, FileVideo, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import ClapprStreamingPlayer from '../../components/players/ClapprStreamingPlayer';

interface RecordingStatus {
  isRecording: boolean;
  fileName?: string;
  startTime?: string;
  duration?: string;
}

const GravadorTransmissao: React.FC = () => {
  const { user, getToken } = useAuth();
  const [recording, setRecording] = useState<RecordingStatus>({
    isRecording: false
  });
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const userLogin = user?.usuario || (user?.email ? user.email.split('@')[0] : 'usuario');
  const streamUrl = `https://stmv1.udicast.com/${userLogin}/${userLogin}/playlist.m3u8`;

  useEffect(() => {
    checkRecordingStatus();
    const interval = setInterval(checkRecordingStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (recording.isRecording && recording.startTime) {
      timer = setInterval(() => {
        const start = new Date(recording.startTime!).getTime();
        const now = new Date().getTime();
        setElapsed(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [recording.isRecording, recording.startTime]);

  const checkRecordingStatus = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/recording-status', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRecording(data);
      }
    } catch (error) {
      console.error('Erro ao verificar status de gravação:', error);
    }
  };

  const handleStartRecording = async () => {
    if (!confirm('Deseja iniciar a gravação da transmissão?')) return;

    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/start-recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Gravação iniciada com sucesso!');
        checkRecordingStatus();
      } else {
        toast.error(result.error || 'Erro ao iniciar gravação');
      }
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast.error('Erro ao iniciar gravação');
    } finally {
      setLoading(false);
    }
  };

  const handleStopRecording = async () => {
    if (!confirm('Deseja parar a gravação?')) return;

    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/stop-recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Gravação finalizada com sucesso!');
        checkRecordingStatus();
        setElapsed(0);
      } else {
        toast.error(result.error || 'Erro ao parar gravação');
      }
    } catch (error) {
      console.error('Erro ao parar gravação:', error);
      toast.error('Erro ao parar gravação');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gravador de Transmissão</h1>
        <p className="text-gray-600">Grave sua transmissão ao vivo para arquivamento</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Informação Importante:</p>
            <p>A gravação será salva automaticamente no servidor. Certifique-se de ter espaço suficiente disponível.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Preview da Transmissão</h2>
            </div>
            <div className="bg-black" style={{ paddingTop: '56.25%', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                <ClapprStreamingPlayer
                  src={streamUrl}
                  title="Preview"
                  isLive={true}
                  autoplay={false}
                  controls={true}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status da Gravação</h3>

            {recording.isRecording ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-700 font-semibold">GRAVANDO</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Tempo Decorrido
                    </span>
                    <span className="text-lg font-mono font-bold text-gray-900">
                      {formatTime(elapsed)}
                    </span>
                  </div>

                  {recording.fileName && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Arquivo:</p>
                      <p className="text-sm text-gray-900 font-mono break-all">{recording.fileName}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStopRecording}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Square className="h-5 w-5" />
                  <span className="font-semibold">Parar Gravação</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-600 font-semibold">Aguardando</span>
                </div>

                <button
                  onClick={handleStartRecording}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Circle className="h-5 w-5 fill-current" />
                  <span className="font-semibold">Iniciar Gravação</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-900">
                <p className="font-semibold mb-1">Atenção:</p>
                <p>A gravação consome espaço em disco. Não feche esta página durante a gravação.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GravadorTransmissao;
