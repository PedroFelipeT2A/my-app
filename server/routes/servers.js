import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';

const router = express.Router();

// GET /api/servers - Listar servidores
router.get('/', supabaseAuthMiddleware, async (req, res) => {
    try {
        const { data: servers, error } = await supabase
            .from('servers')
            .select('id, nome, nome_principal, ip, created_at')
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json(servers || []);
    } catch (error) {
        console.error('Erro ao buscar servidores:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar servidores',
            details: error.message
        });
    }
});

// GET /api/servers/:id - Obter servidor específico
router.get('/:id', supabaseAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: server, error } = await supabase
            .from('servers')
            .select('id, nome, nome_principal, ip, porta_ssh, usuario_ssh, created_at')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!server) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        res.json(server);
    } catch (error) {
        console.error('Erro ao buscar servidor:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar servidor',
            details: error.message
        });
    }
});

// POST /api/servers - Criar novo servidor (apenas admin)
router.post('/', supabaseAuthMiddleware, async (req, res) => {
    try {
        const { nome, nome_principal, ip, porta_ssh, usuario_ssh, senha_ssh } = req.body;

        if (!nome || !ip || !porta_ssh || !usuario_ssh || !senha_ssh) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios: nome, ip, porta_ssh, usuario_ssh, senha_ssh' 
            });
        }

        const { data: server, error } = await supabase
            .from('servers')
            .insert({
                nome,
                nome_principal,
                ip,
                porta_ssh,
                usuario_ssh,
                senha_ssh
            })
            .select()
            .single();

        if (error) throw error;

        // Remover senha da resposta
        const { senha_ssh: _, ...serverResponse } = server;

        res.status(201).json(serverResponse);
    } catch (error) {
        console.error('Erro ao criar servidor:', error);
        res.status(500).json({ 
            error: 'Erro ao criar servidor',
            details: error.message
        });
    }
});

// PUT /api/servers/:id - Atualizar servidor (apenas admin)
router.put('/:id', supabaseAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, nome_principal, ip, porta_ssh, usuario_ssh, senha_ssh } = req.body;

        const updateData = {};
        if (nome !== undefined) updateData.nome = nome;
        if (nome_principal !== undefined) updateData.nome_principal = nome_principal;
        if (ip !== undefined) updateData.ip = ip;
        if (porta_ssh !== undefined) updateData.porta_ssh = porta_ssh;
        if (usuario_ssh !== undefined) updateData.usuario_ssh = usuario_ssh;
        if (senha_ssh !== undefined) updateData.senha_ssh = senha_ssh;

        const { data: server, error } = await supabase
            .from('servers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (!server) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        // Remover senha da resposta
        const { senha_ssh: _, ...serverResponse } = server;

        res.json(serverResponse);
    } catch (error) {
        console.error('Erro ao atualizar servidor:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar servidor',
            details: error.message
        });
    }
});

// DELETE /api/servers/:id - Deletar servidor (apenas admin)
router.delete('/:id', supabaseAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se há streams usando este servidor
        const { data: activeStreams } = await supabase
            .from('streams')
            .select('id')
            .eq('server_id', id)
            .eq('is_live', true);

        if (activeStreams && activeStreams.length > 0) {
            return res.status(400).json({ 
                error: 'Não é possível deletar servidor com streams ativas' 
            });
        }

        const { error } = await supabase
            .from('servers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar servidor:', error);
        res.status(500).json({ 
            error: 'Erro ao deletar servidor',
            details: error.message
        });
    }
});

export default router;