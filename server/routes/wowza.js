import express from 'express';
import { supabaseAuthMiddleware } from '../supabaseClient.js';
import { WowzaStreamingService } from '../services/WowzaStreamingService.js';

const router = express.Router();

// Testar conexão com Wowza
router.get('/test-connection', supabaseAuthMiddleware, async (req, res) => {
    try {
        const wowzaService = new WowzaStreamingService();
        const result = await wowzaService.testConnection();

        res.json({
            success: result.success,
            connected: result.connected,
            message: result.connected ? 'Conexão com Wowza estabelecida' : 'Falha na conexão com Wowza',
            data: result.data,
            error: result.error
        });
    } catch (error) {
        console.error('Erro ao testar conexão:', error);
        res.status(500).json({
            success: false,
            connected: false,
            message: 'Erro ao testar conexão com Wowza',
            error: error.message
        });
    }
});

// Listar aplicações do Wowza
router.get('/applications', supabaseAuthMiddleware, async (req, res) => {
    try {
        const wowzaService = new WowzaStreamingService();
        const result = await wowzaService.listApplications();

        if (result.success) {
            res.json({
                success: true,
                applications: result.data || []
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Erro ao listar aplicações'
            });
        }
    } catch (error) {
        console.error('Erro ao listar aplicações:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obter informações do servidor Wowza
router.get('/server-info', supabaseAuthMiddleware, async (req, res) => {
    try {
        const wowzaService = new WowzaStreamingService();
        const result = await wowzaService.makeWowzaRequest('/v2/servers/_defaultServer_');

        if (result.success) {
            res.json({
                success: true,
                serverInfo: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erro ao obter informações do servidor'
            });
        }
    } catch (error) {
        console.error('Erro ao obter informações do servidor:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obter estatísticas gerais do Wowza
router.get('/stats', supabaseAuthMiddleware, async (req, res) => {
    try {
        const wowzaService = new WowzaStreamingService();
        const result = await wowzaService.makeWowzaRequest('/v2/servers/_defaultServer_/stats');

        if (result.success) {
            res.json({
                success: true,
                stats: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erro ao obter estatísticas'
            });
        }
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;