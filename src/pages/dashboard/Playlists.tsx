import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, PlusCircle, X, Edit2, Trash2, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/types/supabasetypes';
import { toast } from 'react-toastify';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';

import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

const Playlists: React.FC = () => {
  type PlaylistBase = Database['public']['Tables']['playlists']['Row'];
  type Playlist = PlaylistBase & { quantidadeVideos?: number; duracaoTotal?: number };
  type Folder = Database['public']['Tables']['folders']['Row'];
  type Video = Database['public']['Tables']['videos']['Row'];

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [nomePlaylist, setNomePlaylist] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [videosByFolder, setVideosByFolder] = useState<Record<number, Video[]>>({});
  const [selectedVideos, setSelectedVideos] = useState<Video[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});

  const [videoPlayerModalOpen, setVideoPlayerModalOpen] = useState(false);
  const [videoPlayerSrc, setVideoPlayerSrc] = useState<string>('');
  const [playlistVideosToPlay, setPlaylistVideosToPlay] = useState<Video[]>([]);
  const [playlistPlayerIndex, setPlaylistPlayerIndex] = useState(0);

  // Modal de confirmação
  const [modalConfirmacao, setModalConfirmacao] = useState({
    aberto: false,
    playlist: null as Playlist | null,
    titulo: '',
    mensagem: '',
    detalhes: ''
  });

  const carregarPlaylists = async () => {
    setStatus(null);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return setStatus('Usuário não autenticado');

    const { data: playlistsData } = await supabase
      .from('playlists')
      .select('*')
      .eq('id_user', user.id);

    const playlistsComStats = await Promise.all(
      (playlistsData || []).map(async (playlist) => {
        const { data: playlistVideos } = await supabase
          .from('playlist_videos')
          .select('videos(duracao)')
          .eq('id_playlist', playlist.id);

        const quantidadeVideos = playlistVideos?.length || 0;

        const duracaoTotal = (playlistVideos || []).reduce((acc, item) => {
          const videosField = (item as any).videos;
          let duracao = 0;
          if (Array.isArray(videosField)) {
            duracao = Math.ceil(videosField[0]?.duracao ?? 0);
          } else if (videosField && typeof videosField === 'object') {
            duracao = Math.ceil(videosField.duracao ?? 0);
          }
          return acc + duracao;
        }, 0);

        return { ...playlist, quantidadeVideos, duracaoTotal };
      })
    );

    setPlaylists(playlistsComStats);
  };

  const carregarFoldersEVideos = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return;

    const { data: foldersData } = await supabase
      .from('folders')
      .select('*')
      .eq('id_user', user.id)
      .order('nome');

    if (!foldersData) return;
    setFolders(foldersData);
    setExpandedFolders(Object.fromEntries(foldersData.map((f) => [f.id, false])));

    const folderIds = foldersData.map((f) => f.id);
    const { data: videosData } = await supabase
      .from('videos')
      .select('*')
      .in('id_folder', folderIds)
      .order('nome');

    const grouped: Record<number, Video[]> = {};
    foldersData.forEach(f => grouped[f.id] = []);
    (videosData || []).forEach(v => grouped[v.id_folder]?.push(v));
    setVideosByFolder(grouped);
  };

  useEffect(() => {
    carregarPlaylists();
  }, []);

  const abrirModal = async (playlist?: Playlist) => {
    setStatus(null);
    await carregarFoldersEVideos();
    if (playlist) {
      setNomePlaylist(playlist.nome ?? '');
      setEditingId(playlist.id);
      const { data: selected } = await supabase
        .from('playlist_videos')
        .select('videos(*)')
        .eq('id_playlist', playlist.id)
        .order('ordem');
      setSelectedVideos(selected?.map(item => (item as any).videos) || []);
    } else {
      setNomePlaylist('');
      setEditingId(null);
      setSelectedVideos([]);
    }
    setShowModal(true);
  };

  const salvarPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setStatus('Usuário não autenticado');

    try {
      let playlistId = editingId;

      if (editingId) {
        await supabase.from('playlists').update({ nome: nomePlaylist }).eq('id', editingId);
      } else {
        const { data } = await supabase
          .from('playlists')
          .insert({ nome: nomePlaylist, id_user: user.id })
          .select('id')
          .single();
        playlistId = data?.id;
      }

      if (playlistId) {
        await supabase.from('playlist_videos').delete().eq('id_playlist', playlistId);

        const insertData = selectedVideos.map((video, index) => ({
          id_playlist: playlistId,
          id_video: video.id,
          ordem: index,
        }));

        await supabase.from('playlist_videos').insert(insertData);
      }

      setShowModal(false);
      setNomePlaylist('');
      setEditingId(null);
      setSelectedVideos([]);
      carregarPlaylists();
    } catch (err: any) {
      setStatus(err.message || 'Erro ao salvar playlist');
    } finally {
      setLoading(false);
    }
  };

  const confirmarDeletarPlaylist = (playlist: Playlist) => {
    setModalConfirmacao({
      aberto: true,
      playlist,
      titulo: 'Confirmar Exclusão da Playlist',
      mensagem: `Deseja realmente excluir a playlist "${playlist.nome}"?`,
      detalhes: 'Esta ação não pode ser desfeita. Certifique-se de que a playlist não está sendo usada em transmissões ou agendamentos.'
    });
  };

  const executarDelecaoPlaylist = async () => {
    const { playlist } = modalConfirmacao;
    if (!playlist) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`/api/playlists/${playlist.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.details || errorData.error || 'Erro ao excluir playlist');
        return;
      }

      toast.success('Playlist excluída com sucesso!');
      carregarPlaylists();
    } catch (error) {
      toast.error('Erro ao excluir playlist');
      console.error('Erro na exclusão:', error);
    } finally {
      setModalConfirmacao({
        aberto: false,
        playlist: null,
        titulo: '',
        mensagem: '',
        detalhes: ''
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (
      active.id.toString().startsWith('selected-') &&
      over.id.toString().startsWith('selected-')
    ) {
      const oldIndex = Number(active.id.toString().replace('selected-', ''));
      const newIndex = Number(over.id.toString().replace('selected-', ''));
      if (oldIndex !== newIndex) {
        setSelectedVideos((items) => arrayMove(items, oldIndex, newIndex));
      }
    } else if (
      active.id.toString().startsWith('available-') &&
      (over.id.toString() === 'selected-container' ||
        over.id.toString().startsWith('selected-'))
    ) {
      const videoId = Number(active.id.toString().replace('available-', ''));
      const video = Object.values(videosByFolder)
        .flat()
        .find((v) => v.id === videoId);
      if (video) {
        setSelectedVideos((prev) => [...prev, video]);
      }
    }
  };

  function AvailableVideo({ video, index }: { video: Video; index: number }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `available-${video.id}` });
    const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      cursor: 'grab',
    };
    return (
      <li
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="p-1 text-sm hover:bg-zinc-100 rounded flex justify-between items-center cursor-pointer"
      >
        <span onClick={() => setSelectedVideos((prev) => [...prev, video])}>
          {video.nome}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (video.url) {
              setVideoPlayerSrc(video.url);
              setVideoPlayerModalOpen(true);
            }
          }}
          className="text-blue-600 hover:text-blue-800 p-1"
          title="Assistir vídeo"
        >
          <Play size={16} />
        </button>
      </li>
    );
  }

  function SelectedVideo({ video, index }: { video: Video; index: number }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `selected-${index}` });
    const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      cursor: 'grab',
    };
    return (
      <li
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="flex justify-between items-center p-2 mb-1 bg-zinc-100 rounded cursor-move"
      >
        <span>{video.nome}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (video.url) {
                setVideoPlayerSrc(video.url);
                setVideoPlayerModalOpen(true);
              }
            }}
            className="text-blue-600 hover:text-blue-800 p-1"
            title="Assistir vídeo"
          >
            <Play size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedVideos((prev) => {
                const copy = [...prev];
                copy.splice(index, 1);
                return copy;
              });
            }}
            className="text-red-600"
            title="Remover vídeo"
          >
            <X size={16} />
          </button>
        </div>
      </li>
    );
  }

  const adicionarTodosDaPasta = (folderId: number) => {
    const videos = videosByFolder[folderId] || [];
    setSelectedVideos(prev => [...prev, ...videos]);
  };

  const removerTodos = () => setSelectedVideos([]);

  const toggleFolder = (id: number) => setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));

  const formatarDuracao = (s: number) =>
    [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map(v => String(v).padStart(2, '0'))
      .join(':');

  const abrirPlayerPlaylist = async (playlistId: number) => {
    setPlaylistVideosToPlay([]);
    setPlaylistPlayerIndex(0);
    setVideoPlayerModalOpen(false);

    const { data: playlistVideos, error } = await supabase
      .from('playlist_videos')
      .select('videos(*)')
      .eq('id_playlist', playlistId)
      .order('ordem', { ascending: true });

    if (error || !playlistVideos) {
      alert('Erro ao carregar vídeos da playlist');
      return;
    }

    const videos: Video[] = playlistVideos.map((item) => (item as any).videos);
    setPlaylistVideosToPlay(videos);
    setPlaylistPlayerIndex(0);
    setVideoPlayerModalOpen(true);
  };

  useEffect(() => {
    if (playlistVideosToPlay.length > 0 && videoPlayerModalOpen) {
      setVideoPlayerSrc(playlistVideosToPlay[playlistPlayerIndex]?.url || '');
    }
  }, [playlistPlayerIndex, playlistVideosToPlay, videoPlayerModalOpen]);

  const handleVideoEnded = () => {
    if (playlistPlayerIndex < playlistVideosToPlay.length - 1) {
      setPlaylistPlayerIndex(i => i + 1);
    } else {
      setVideoPlayerModalOpen(false);
      setPlaylistVideosToPlay([]);
      setPlaylistPlayerIndex(0);
    }
  };

  // Modal de confirmação
  function ModalConfirmacao({
    aberto,
    onFechar,
    onConfirmar,
    titulo,
    mensagem,
    detalhes,
  }: {
    aberto: boolean;
    onFechar: () => void;
    onConfirmar: () => void;
    titulo: string;
    mensagem: string;
    detalhes?: string;
  }) {
    if (!aberto) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{titulo}</h3>
          <p className="text-gray-700 mb-4">{mensagem}</p>
          {detalhes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800">{detalhes}</p>
            </div>
          )}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onFechar}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirmar}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Confirmar Exclusão
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 w-full h-full min-h-screen bg-white">
      <header className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-extrabold text-gray-900">Playlists</h1>

        <button
          className="bg-blue-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors duration-200 shadow"
          onClick={() => abrirModal()}
        >
          <PlusCircle size={20} />
          Nova Playlist
        </button>
      </header>

      <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-sm bg-white">
        <table className="w-full min-w-[600px] border-collapse bg-white">
          <thead className="bg-blue-50">
            <tr>
              <th className="text-left p-4 font-semibold text-blue-800 border-b border-blue-100">Nome</th>
              <th className="text-center p-4 font-semibold text-blue-800 border-b border-blue-100 w-28">Qtd. Vídeos</th>
              <th className="text-center p-4 font-semibold text-blue-800 border-b border-blue-100 w-36">Duração Total</th>
              <th className="text-center p-4 font-semibold text-blue-800 border-b border-blue-100 w-40">Ações</th>
            </tr>
          </thead>
          <tbody>
            {playlists.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-500 p-6">
                  Nenhuma playlist criada
                </td>
              </tr>
            )}
            {playlists.map((playlist) => (
              <tr
                key={playlist.id}
                className="cursor-pointer transition-colors duration-150 hover:bg-blue-100"
              >
                <td className="p-4 max-w-xs truncate">{playlist.nome}</td>
                <td className="p-4 text-center">{playlist.quantidadeVideos ?? 0}</td>
                <td className="p-4 text-center">
                  {playlist.duracaoTotal ? formatarDuracao(playlist.duracaoTotal) : '00:00:00'}
                </td>
                <td className="p-4 flex justify-center gap-4 text-blue-600">
                  <button
                    title="Abrir player"
                    onClick={() => abrirPlayerPlaylist(playlist.id)}
                    className="hover:text-blue-800 transition"
                  >
                    <Play size={18} />
                  </button>
                  <button
                    title="Editar"
                    onClick={() => abrirModal(playlist)}
                    className="hover:text-blue-800 transition"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    title="Deletar"
                    onClick={() => confirmarDeletarPlaylist(playlist)}
                    className="text-red-600 hover:text-red-800 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 overflow-auto">
          <div className="bg-white rounded-xl p-8 max-w-[90vw] max-h-[90vh] w-full overflow-auto shadow-2xl border border-gray-300">
            <form onSubmit={salvarPlaylist} className="h-full flex flex-col">
              <div className="mb-6">
                <label htmlFor="nome" className="block mb-2 font-semibold text-gray-800 text-lg">
                  Nome da playlist
                </label>
                <input
                  id="nome"
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={nomePlaylist}
                  onChange={(e) => setNomePlaylist(e.target.value)}
                  required
                />
              </div>

              <div className="mb-6 flex gap-6 flex-grow overflow-hidden">
                {/* Lista de pastas e vídeos disponíveis */}
                <div className="flex-1 max-h-full overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                  <h2 className="font-semibold mb-3 text-gray-900 text-lg">Pastas e vídeos disponíveis</h2>
                  {folders.map((folder) => (
                    <div key={folder.id} className="mb-3">
                      <div
                        className="flex items-center justify-between cursor-pointer select-none border-b border-gray-200 pb-2 mb-3 hover:bg-gray-100 transition-colors duration-200"
                        onClick={() => toggleFolder(folder.id)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedFolders[folder.id] ? (
                            <ChevronDown size={20} className="text-blue-600" />
                          ) : (
                            <ChevronRight size={20} className="text-blue-600" />
                          )}
                          <span className="font-semibold text-gray-900 text-lg">{folder.nome}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            adicionarTodosDaPasta(folder.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                          title="Adicionar todos da pasta"
                        >
                          <PlusCircle size={22} />
                        </button>
                      </div>

                      {expandedFolders[folder.id] && (
                        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                          <SortableContext
                            items={videosByFolder[folder.id]?.map(v => `available-${v.id}`) || []}
                            strategy={verticalListSortingStrategy}
                          >
                            <ul>
                              {(videosByFolder[folder.id] || []).map((video, index) => (
                                <AvailableVideo key={video.id} video={video} index={index} />
                              ))}
                            </ul>
                          </SortableContext>
                        </DndContext>
                      )}
                    </div>
                  ))}
                </div>

                {/* Lista de vídeos selecionados na playlist */}
                <div className="flex-1 max-h-full overflow-y-auto border border-gray-300 rounded-md p-3 flex flex-col bg-gray-50">
                  <h2 className="font-semibold mb-3 flex justify-between items-center text-gray-900 text-lg">
                    Vídeos na playlist
                    <button
                      type="button"
                      onClick={removerTodos}
                      className="text-red-600 hover:text-red-800 transition-colors duration-200"
                      title="Remover todos"
                    >
                      <X size={20} />
                    </button>
                  </h2>

                  <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                    <SortableContext
                      items={selectedVideos.map((_, i) => `selected-${i}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="flex-grow overflow-y-auto">
                        {selectedVideos.map((video, index) => (
                          <SelectedVideo key={`${video.id}-${index}`} video={video} index={index} />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>

              {status && <p className="mb-4 text-red-600 font-semibold">{status}</p>}

              <div className="flex justify-end gap-3 mt-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200 disabled:opacity-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {videoPlayerModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4">
          <div className="bg-black rounded max-w-[90vw] max-h-[90vh] w-full h-full relative flex flex-col items-center p-4">
            <video
              key={videoPlayerSrc}
              src={videoPlayerSrc}
              controls
              autoPlay
              className="w-full h-full rounded object-contain"
              onEnded={
                playlistVideosToPlay.length > 0
                  ? handleVideoEnded
                  : () => setVideoPlayerModalOpen(false)
              }
            />
            <button
              type="button"
              onClick={() => {
                setVideoPlayerModalOpen(false);
                setPlaylistVideosToPlay([]);
                setPlaylistPlayerIndex(0);
              }}
              className="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded p-1 hover:bg-opacity-80 transition-colors duration-200"
              aria-label="Fechar player"
            >
              <X size={24} />
            </button>

            {playlistVideosToPlay.length > 0 && (
              <div className="flex justify-between w-full mt-2 text-white px-2">
                <button
                  disabled={playlistPlayerIndex === 0}
                  onClick={() => setPlaylistPlayerIndex(i => Math.max(i - 1, 0))}
                  className="px-3 py-1 bg-zinc-700 rounded disabled:opacity-50 transition-colors duration-200"
                >
                  Anterior
                </button>

                <span>
                  {playlistPlayerIndex + 1} / {playlistVideosToPlay.length}
                </span>

                <button
                  disabled={playlistPlayerIndex === playlistVideosToPlay.length - 1}
                  onClick={() => setPlaylistPlayerIndex(i => Math.min(i + 1, playlistVideosToPlay.length - 1))}
                  className="px-3 py-1 bg-zinc-700 rounded disabled:opacity-50 transition-colors duration-200"
                >
                  Próximo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmação */}
      <ModalConfirmacao
        aberto={modalConfirmacao.aberto}
        onFechar={() => setModalConfirmacao(prev => ({ ...prev, aberto: false }))}
        onConfirmar={executarDelecaoPlaylist}
        titulo={modalConfirmacao.titulo}
        mensagem={modalConfirmacao.mensagem}
        detalhes={modalConfirmacao.detalhes}
      />
    </div>
  );
};

export default Playlists;