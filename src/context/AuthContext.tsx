import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';
import { z } from 'zod';

const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  nome: z.string(),
  streamings: z.number(),
  espectadores: z.number(),
  bitrate: z.number(),
  espaco: z.number(),
});

type User = z.infer<typeof userSchema>;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState(true); // Novo estado loading
  const navigate = useNavigate();

  useEffect(() => {
    // Verifica a sessão ao montar o provider
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserData(session.user).finally(() => setLoading(false));
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    // Assina para mudanças na autenticação (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserData(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setUserData = async (authUser: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) throw error;

      const userData = {
        id: authUser.id,
        email: authUser.email!,
        nome: data.nome,
        streamings: data.streamings || 0,
        espectadores: data.espectadores || 0,
        bitrate: data.bitrate || 0,
        espaco: data.espaco || 0,
      };

      const validatedUser = userSchema.parse(userData);
      setUser(validatedUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error setting user data:', error);
      toast.error('Erro ao carregar dados do usuário');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const login = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      await setUserData(data.user);  // atualiza o estado antes de navegar
      navigate('/dashboard');
      toast.success('Login realizado com sucesso!');
    }
  } catch (error: any) {
    toast.error(error.message || 'Erro ao fazer login');
    throw error;
  }
};


  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setIsAuthenticated(false);
      navigate('/login');
      toast.info('Logout realizado com sucesso');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer logout');
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome: name,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: data.user.id,
              nome: name,
              email: email,
              streamings: 0,
              espectadores: 0,
              bitrate: 0,
              espaco: 0,
            },
          ]);

        if (profileError) throw profileError;

        toast.success('Cadastro realizado com sucesso! Verifique seu email.');
        navigate('/login');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
      throw error;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast.success('Email de recuperação enviado!');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email de recuperação');
      throw error;
    }
  };

  // Renderiza um fallback enquanto carrega a sessão
  if (loading) {
    return <div>Carregando...</div>; // Aqui pode ser um spinner ou qualquer componente de loading
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, forgotPassword, register, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};
