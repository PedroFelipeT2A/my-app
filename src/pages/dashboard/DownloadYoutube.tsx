import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; // ajuste o caminho conforme seu projeto

type Folder = {
  id: number;
  nome: string;
};

type VideoResponse = {
  video: {
    nome: string;
    // outros campos se precisar
  };
};

export default function BaixarYoutube() {
  const { getToken } = useAuth();
  const [url, setUrl] = useState('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [idPasta, setIdPasta] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const carregarPastas = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Usuário não autenticado');

        const response = await fetch('/api/folders', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao carregar pastas');
        }

        const data: Folder[] = await response.json();
        setFolders(data);
      } catch (err) {
        toast.error('Erro ao carregar pastas');
      }
    };

    carregarPastas();
  }, [getToken]);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url || !idPasta) {
      toast.warning('Preencha o link e selecione uma pasta');
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Usuário não autenticado');

      const response = await fetch('/api/downloadyoutube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url,
          id_pasta: idPasta,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao baixar vídeo');
      }

      const data: VideoResponse = await response.json();

      toast.success(`✅ Vídeo "${data.video.nome}" baixado com sucesso!`);
      setUrl('');
      setIdPasta('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao baixar vídeo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Download className="w-5 h-5" /> Baixar vídeo do YouTube
      </h2>

      <form onSubmit={handleDownload} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Link do YouTube</label>
          <input
            type="url"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="https://youtube.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Selecionar Pasta</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={idPasta}
            onChange={(e) => setIdPasta(e.target.value)}
            required
          >
            <option value="">Selecione uma pasta</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id.toString()}>
                {folder.nome}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Baixando...' : 'Baixar Vídeo'}
        </button>
      </form>
    </div>
  );
}
