// src/components/AgendamentoForm.tsx
import { useState, useEffect } from 'react';

export default function AgendamentoForm({ onSave }: { onSave: () => void }) {
  const [playlists, setPlaylists] = useState([]);
  const [formData, setFormData] = useState({
    data: '',
    playlist_id: '',
    shuffle: 'nao',
    frequencia: 'especifica',
    finalizacao: 'repetir',
    codigo_playlist_finalizacao: 0,
    inicio: 2,
  });

  useEffect(() => {
    fetch('/api/playlists').then(res => res.json()).then(setPlaylists);
  }, []);

  function handleChange(e: any) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit() {
    const res = await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (res.ok) onSave();
  }

  return (
    <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="space-y-3">
      <select name="playlist_id" onChange={handleChange}>
        <option value="">Selecione uma playlist</option>
        {playlists.map((p: any) => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>

      <select name="shuffle" value={formData.shuffle} onChange={handleChange}>
        <option value="nao">Misturar Vídeos: Não</option>
        <option value="sim">Misturar Vídeos: Sim</option>
      </select>

      <select name="frequencia" value={formData.frequencia} onChange={handleChange}>
        <option value="especifica">Executar em data específica</option>
        <option value="diaria">Executar diariamente</option>
        <option value="semana">Executar em dias da semana</option>
      </select>

      <select name="finalizacao" value={formData.finalizacao} onChange={handleChange}>
        <option value="repetir">Repetir</option>
        <option value="outra_playlist">Outra Playlist</option>
      </select>

      <input
        type="number"
        name="codigo_playlist_finalizacao"
        value={formData.codigo_playlist_finalizacao}
        onChange={handleChange}
        placeholder="Código Playlist Finalização"
      />

      <input
        type="number"
        name="inicio"
        value={formData.inicio}
        onChange={handleChange}
        placeholder="Início (2 = normal)"
      />

      <button type="submit">Salvar Agendamento</button>
    </form>
  );
}
