// server/middlewares/supabaseAuthMiddleware.js
import { supabase } from '../supabaseClient.js';

const supabaseAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de autenticação ausente ou inválido' });
        }

        const token = authHeader.replace('Bearer ', '');

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('Erro no middleware de autenticação:', err.message);
        res.status(500).json({ error: 'Erro interno na autenticação' });
    }
};

export default supabaseAuthMiddleware;
