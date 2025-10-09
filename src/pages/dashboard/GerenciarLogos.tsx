import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Image, Upload, Trash2, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface Logo {
  codigo: number;
  nome: string;
  arquivo: string;
  tamanho: number;
  tipo_arquivo: string;
  data_upload: string;
}

const GerenciarLogos: React.FC = () => {
  const { getToken } = useAuth();
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [logoName, setLogoName] = useState('');

  useEffect(() => {
    loadLogos();
  }, []);

  const loadLogos = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/logos', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLogos(data);
      }
    } catch (error) {
      console.error('Erro ao carregar logos:', error);
      toast.error('Erro ao carregar logos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas arquivos de imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo não pode ter mais de 5MB');
      return;
    }

    setSelectedFile(file);
    setLogoName(file.name.split('.')[0]);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !logoName) {
      toast.error('Preencha o nome e selecione um arquivo');
      return;
    }

    setUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('logo', selectedFile);
      formData.append('nome', logoName);

      const response = await fetch('/api/logos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Logo enviado com sucesso!');
        setSelectedFile(null);
        setPreviewUrl('');
        setLogoName('');
        loadLogos();
      } else {
        toast.error(result.error || 'Erro ao enviar logo');
      }
    } catch (error) {
      console.error('Erro ao enviar logo:', error);
      toast.error('Erro ao enviar logo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja remover este logo?')) return;

    try {
      const token = await getToken();
      const response = await fetch(`/api/logos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Logo removido com sucesso');
        loadLogos();
      } else {
        toast.error('Erro ao remover logo');
      }
    } catch (error) {
      console.error('Erro ao remover logo:', error);
      toast.error('Erro ao remover logo');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gerenciar Logos</h1>
        <p className="text-gray-600">Configure logos para suas transmissões M3U8</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Como Funciona:</p>
            <p>Os logos enviados aqui podem ser aplicados automaticamente em suas playlists de transmissão M3U8, sem necessidade de editar cada vídeo individualmente.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enviar Novo Logo</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Logo
                </label>
                <input
                  type="text"
                  value={logoName}
                  onChange={(e) => setLogoName(e.target.value)}
                  placeholder="Ex: Logo Principal"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arquivo de Imagem
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition-colors">
                  <div className="space-y-1 text-center">
                    {previewUrl ? (
                      <div className="mb-4">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="mx-auto h-32 w-auto object-contain"
                        />
                      </div>
                    ) : (
                      <Image className="mx-auto h-12 w-12 text-gray-400" />
                    )}
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                        <span>Selecionar arquivo</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleFileSelect}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG até 5MB</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={!selectedFile || !logoName || uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-5 w-5" />
                <span className="font-semibold">
                  {uploading ? 'Enviando...' : 'Enviar Logo'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Logos Cadastrados</h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : logos.length === 0 ? (
              <div className="text-center py-12">
                <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum logo cadastrado</p>
                <p className="text-sm text-gray-400 mt-1">Envie seu primeiro logo</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {logos.map((logo) => (
                  <div
                    key={`logo-${logo.codigo}`}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{logo.nome}</h3>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(logo.tamanho)} • {logo.tipo_arquivo}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(logo.data_upload).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(logo.codigo)}
                        className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="bg-gray-100 rounded-lg p-3 flex items-center justify-center min-h-[120px]">
                      {logo.arquivo ? (
                        <img
                          src={`/api/logos/${logo.codigo}/file`}
                          alt={logo.nome}
                          className="max-h-[100px] max-w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23ddd"/></svg>';
                          }}
                        />
                      ) : (
                        <div className="text-gray-400 text-sm">Imagem não disponível</div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Aplicar em Playlist
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-900">
            <p className="font-semibold mb-1">Dica:</p>
            <p>Para melhor qualidade, use logos em formato PNG com fundo transparente e dimensões de 300x100 pixels.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GerenciarLogos;
