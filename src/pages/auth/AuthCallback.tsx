import React, { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    async function handleAuthCallback() {
      const access_token = searchParams.get('access_token');
      const type = searchParams.get('type'); // pode ser 'signup' ou 'recovery'

      if (!access_token) {
        alert('Token não encontrado na URL.');
        navigate('/login');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(access_token);

      if (error) {
        alert('Erro ao validar token: ' + error.message);
        navigate('/login');
        return;
      }

      if (type === 'recovery') {
        // Redireciona para a página de reset de senha, onde o usuário vai escolher nova senha
        navigate('/reset-password');
      } else if (type === 'signup') {
        alert('Email confirmado com sucesso! Você já pode fazer login.');
        navigate('/login');
      } else {
        // Outros tipos ou padrão: redirecionar para login
        navigate('/login');
      }
    }

    handleAuthCallback();
  }, [navigate, searchParams]);

  return <p>Processando autenticação, aguarde...</p>;
};

export default AuthCallback;
