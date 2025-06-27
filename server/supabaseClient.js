import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function supabaseAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não enviado' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token inválido' });

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) return res.status(401).json({ error: 'Usuário não autenticado' });

    req.user = data.user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno na autenticação' });
  }
}
