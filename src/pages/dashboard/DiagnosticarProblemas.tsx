import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, AlertTriangle, CheckCircle, XCircle, Loader, RefreshCw, Server, Wifi, Shield } from 'lucide-react';
import { toast } from 'react-toastify';

interface DiagnosticResult {
  status: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  details?: string;
}

const DiagnosticarProblemas: React.FC = () => {
  const { user, getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [selectedTest, setSelectedTest] = useState<'all' | 'wowza' | 'ssl' | 'm3u8'>('all');

  const runDiagnostics = async () => {
    setLoading(true);
    setResults([]);

    try {
      const token = await getToken();
      const response = await fetch('/api/streaming/diagnostics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ testType: selectedTest })
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);

        const hasErrors = data.results.some((r: DiagnosticResult) => r.status === 'error');
        const hasWarnings = data.results.some((r: DiagnosticResult) => r.status === 'warning');

        if (!hasErrors && !hasWarnings) {
          toast.success('Nenhum problema encontrado!');
        } else if (hasErrors) {
          toast.warning('Problemas encontrados e corrigidos');
        } else {
          toast.info('Avisos encontrados');
        }
      } else {
        toast.error(data.error || 'Erro ao executar diagnóstico');
      }
    } catch (error) {
      console.error('Erro ao diagnosticar:', error);
      toast.error('Erro ao executar diagnóstico');
      setResults([{
        status: 'error',
        title: 'Erro de Comunicação',
        message: 'Não foi possível conectar ao servidor de diagnóstico'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-900';
      case 'warning':
        return 'text-yellow-900';
      case 'error':
        return 'text-red-900';
      default:
        return 'text-gray-900';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Diagnosticar Problemas</h1>
        <p className="text-gray-600">Verifique e corrija problemas com sua transmissão</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Search className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Como Funciona:</p>
            <p>O diagnóstico verifica configurações do servidor Wowza, SSL, links M3U8 e outros componentes críticos.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipo de Diagnóstico</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => setSelectedTest('all')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedTest === 'all'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Search className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <p className="text-sm font-semibold text-gray-900">Completo</p>
            <p className="text-xs text-gray-600 mt-1">Todos os testes</p>
          </button>

          <button
            onClick={() => setSelectedTest('wowza')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedTest === 'wowza'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Server className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <p className="text-sm font-semibold text-gray-900">Wowza</p>
            <p className="text-xs text-gray-600 mt-1">Configuração</p>
          </button>

          <button
            onClick={() => setSelectedTest('ssl')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedTest === 'ssl'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Shield className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <p className="text-sm font-semibold text-gray-900">SSL</p>
            <p className="text-xs text-gray-600 mt-1">Certificado</p>
          </button>

          <button
            onClick={() => setSelectedTest('m3u8')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedTest === 'm3u8'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Wifi className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <p className="text-sm font-semibold text-gray-900">M3U8</p>
            <p className="text-xs text-gray-600 mt-1">Link streaming</p>
          </button>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader className="h-5 w-5 animate-spin" />
              <span className="font-semibold">Diagnosticando...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5" />
              <span className="font-semibold">Executar Diagnóstico</span>
            </>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resultados</h2>

          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={index}
                className={`border-2 rounded-lg p-4 ${getStatusBg(result.status)}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(result.status)}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold mb-1 ${getStatusText(result.status)}`}>
                      {result.title}
                    </h3>
                    <p className={`text-sm ${getStatusText(result.status)}`}>
                      {result.message}
                    </p>
                    {result.details && (
                      <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs font-mono">
                        {result.details}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Problemas Comuns:</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">•</span>
            <span><strong>Aplicação Wowza não configurada:</strong> A configuração será criada automaticamente</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">•</span>
            <span><strong>SSL inválido:</strong> Contate o suporte para renovação do certificado</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">•</span>
            <span><strong>Link M3U8 offline:</strong> A aplicação será reiniciada automaticamente</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default DiagnosticarProblemas;
