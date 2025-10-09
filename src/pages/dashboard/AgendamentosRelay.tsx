import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, Trash2, Plus, Radio, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'react-toastify';

interface RelaySchedule {
  id: number;
  servidor_relay: string;
  frequencia: number;
  data: string;
  hora: string;
  minuto: string;
  dias: string;
  duracao: string;
  status: number;
}

interface RelayLog {
  id: number;
  data: string;
  servidor_relay: string;
}

const AgendamentosRelay: React.FC = () => {
  const { getToken } = useAuth();
  const [schedules, setSchedules] = useState<RelaySchedule[]>([]);
  const [logs, setLogs] = useState<RelayLog[]>([]);
  const [activeTab, setActiveTab] = useState<'schedules' | 'new' | 'logs'>('schedules');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    servidor_relay: '',
    frequencia: 1,
    data: '',
    hora: '00:00',
    duracao: '00:00',
    dias: [] as number[]
  });

  useEffect(() => {
    loadSchedules();
    loadLogs();
  }, []);

  const loadSchedules = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/relay/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/relay/logs', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.servidor_relay) {
      toast.error('Informe o servidor relay');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/relay/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Agendamento criado com sucesso!');
        setFormData({
          servidor_relay: '',
          frequencia: 1,
          data: '',
          hora: '00:00',
          duracao: '00:00',
          dias: []
        });
        loadSchedules();
        setActiveTab('schedules');
      } else {
        toast.error(result.error || 'Erro ao criar agendamento');
      }
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja remover este agendamento?')) return;

    try {
      const token = await getToken();
      const response = await fetch(`/api/relay/schedules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Agendamento removido');
        loadSchedules();
      } else {
        toast.error('Erro ao remover agendamento');
      }
    } catch (error) {
      console.error('Erro ao remover agendamento:', error);
      toast.error('Erro ao remover agendamento');
    }
  };

  const clearLogs = async () => {
    if (!confirm('Deseja limpar todos os logs?')) return;

    try {
      const token = await getToken();
      const response = await fetch('/api/relay/logs', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Logs removidos');
        loadLogs();
      }
    } catch (error) {
      console.error('Erro ao remover logs:', error);
      toast.error('Erro ao remover logs');
    }
  };

  const getFrequencyText = (schedule: RelaySchedule): string => {
    if (schedule.frequencia === 1) {
      return `Executar no dia ${new Date(schedule.data).toLocaleDateString('pt-BR')} às ${schedule.hora}:${schedule.minuto}`;
    } else if (schedule.frequencia === 2) {
      return `Executar diariamente às ${schedule.hora}:${schedule.minuto}`;
    } else {
      const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
      const dias = schedule.dias.split(',').filter(d => d).map(d => diasSemana[parseInt(d) - 1]).join(', ');
      return `Executar ${dias} às ${schedule.hora}:${schedule.minuto}`;
    }
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      dias: prev.dias.includes(day)
        ? prev.dias.filter(d => d !== day)
        : [...prev.dias, day]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Agendamentos de Relay</h1>
        <p className="text-gray-600">Agende transmissões de relay RTMP/M3U8</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('schedules')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schedules'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="h-5 w-5 inline mr-2" />
              Agendamentos
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'new'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Plus className="h-5 w-5 inline mr-2" />
              Novo Agendamento
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="h-5 w-5 inline mr-2" />
              Logs
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'schedules' && (
            <div>
              {schedules.length === 0 ? (
                <div className="text-center py-12">
                  <Radio className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum agendamento cadastrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map(schedule => (
                    <div key={schedule.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Radio className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-mono text-gray-700">{schedule.servidor_relay}</span>
                          </div>
                          <p className="text-sm text-gray-600">{getFrequencyText(schedule)}</p>
                          {schedule.duracao && schedule.duracao !== '00:00' && (
                            <p className="text-xs text-gray-500 mt-1">Duração: {schedule.duracao}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(schedule.id)}
                          className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'new' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relay RTMP/M3U8
                </label>
                <input
                  type="text"
                  value={formData.servidor_relay}
                  onChange={(e) => setFormData({ ...formData, servidor_relay: e.target.value })}
                  placeholder="https://...m3u8 ou rtmp://..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequência
                </label>
                <select
                  value={formData.frequencia}
                  onChange={(e) => setFormData({ ...formData, frequencia: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>Executar em uma data específica</option>
                  <option value={2}>Executar diariamente</option>
                  <option value={3}>Executar em dias da semana</option>
                </select>
              </div>

              {formData.frequencia === 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>
                  <input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horário de Início
                </label>
                <input
                  type="time"
                  value={formData.hora}
                  onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duração
                </label>
                <input
                  type="time"
                  value={formData.duracao}
                  onChange={(e) => setFormData({ ...formData, duracao: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Deixe em branco para relay sem fim</p>
              </div>

              {formData.frequencia === 3 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dias da Semana
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 1, label: 'Segunda' },
                      { value: 2, label: 'Terça' },
                      { value: 3, label: 'Quarta' },
                      { value: 4, label: 'Quinta' },
                      { value: 5, label: 'Sexta' },
                      { value: 6, label: 'Sábado' },
                      { value: 7, label: 'Domingo' }
                    ].map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.dias.includes(day.value)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
                <span className="font-semibold">Criar Agendamento</span>
              </button>
            </form>
          )}

          {activeTab === 'logs' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Histórico de Execuções</h3>
                {logs.length > 0 && (
                  <button
                    onClick={clearLogs}
                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Limpar Logs
                  </button>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum log disponível</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">{new Date(log.data).toLocaleString('pt-BR')}</span>
                        <span className="text-gray-900 font-mono text-xs">{log.servidor_relay}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgendamentosRelay;
