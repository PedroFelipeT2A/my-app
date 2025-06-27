import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';

const router = express.Router();

// GET /api/transmission-settings - Listar configurações do usuário
router.get('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('transmission_settings')
      .select(`
        *,
        logo:logos(*)
      `)
      .eq('id_user', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar configurações', details: err.message });
  }
});

// POST /api/transmission-settings - Criar nova configuração
router.post('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const configData = {
      ...req.body,
      id_user: userId
    };

    const { data, error } = await supabase
      .from('transmission_settings')
      .insert([configData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar configuração', details: err.message });
  }
});

// PUT /api/transmission-settings/:id - Atualizar configuração
router.put('/:id', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('transmission_settings')
      .update(req.body)
      .eq('id', id)
      .eq('id_user', userId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar configuração', details: err.message });
  }
});

// DELETE /api/transmission-settings/:id - Remover configuração
router.delete('/:id', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('transmission_settings')
      .delete()
      .eq('id', id)
      .eq('id_user', userId);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover configuração', details: err.message });
  }
});

export default router;