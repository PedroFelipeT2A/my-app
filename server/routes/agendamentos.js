import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';

const router = express.Router();

router.get('/', supabaseAuthMiddleware, async (req, res) => {
    const { ano, mes, data, mesAno } = req.query;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });

    try {
        let query = supabase
            .from('playlists_agendamentos')
            .select(`
                *,
                playlist_principal:playlists!playlists_agendamentos_id_playlist_fkey (nome),
                playlist_finalizacao:playlists!playlists_agendamentos_id_playlist_finalizacao_fkey (nome)
            `)
            .eq('id_user', userId);

        if (mesAno) {
            const [anoStr, mesStr] = mesAno.split('-');
            const ano = anoStr;
            const mes = mesStr;

            const inicioMes = `${ano}-${mes.padStart(2, '0')}-01`;
            const mesNum = parseInt(mes, 10);
            const proximoMes = mesNum === 12 ? 1 : mesNum + 1;
            const anoFim = mesNum === 12 ? parseInt(ano, 10) + 1 : parseInt(ano, 10);
            const fimMes = `${anoFim}-${proximoMes.toString().padStart(2, '0')}-01`;

            query = query.gte('data', inicioMes).lt('data', fimMes);
        } else if (ano && mes) {
            const inicioMes = `${ano}-${mes.padStart(2, '0')}-01`;
            const mesNum = parseInt(mes, 10);
            const proximoMes = mesNum === 12 ? 1 : mesNum + 1;
            const anoFim = mesNum === 12 ? parseInt(ano, 10) + 1 : parseInt(ano, 10);
            const fimMes = `${anoFim}-${proximoMes.toString().padStart(2, '0')}-01`;

            query = query.gte('data', inicioMes).lt('data', fimMes);
        } else if (data) {
            query = query.eq('data', data);
        }

        const { data: agendamentos, error } = await query;

        if (error) {
            console.error('Erro ao buscar agendamentos no Supabase:', error.message);
            return res.status(500).json({ error: error.message });
        }

        res.json(agendamentos);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Erro interno no servidor' });
    }
});

router.post('/', supabaseAuthMiddleware, async (req, res) => {
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });

    try {
        const novoAgendamento = {
            ...req.body,
            id_user: userId,
        };

        console.log('Dados recebidos para novo agendamento:', novoAgendamento);

        const { data, error } = await supabase
            .from('playlists_agendamentos')
            .insert(novoAgendamento)
            .select();

        if (error) {
            console.error('Erro ao inserir agendamento:', error);
            return res.status(500).json({ error: error.message });
        }

        res.status(201).json(data[0]);
    } catch (err) {
        console.error('Erro inesperado no servidor:', err);
        res.status(500).json({ error: err.message || 'Erro ao criar agendamento' });
    }
});

router.put('/:id', supabaseAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });

    try {
        const { error } = await supabase
            .from('playlists_agendamentos')
            .update(req.body)
            .eq('id', id)
            .eq('id_user', userId);

        if (error) return res.status(500).json({ error: error.message });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Erro ao atualizar agendamento' });
    }
});

router.delete('/:id', supabaseAuthMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });

    try {
        const { error } = await supabase
            .from('playlists_agendamentos')
            .delete()
            .eq('id', id)
            .eq('id_user', userId);

        if (error) return res.status(500).json({ error: error.message });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Erro ao excluir agendamento' });
    }
});

export default router;
