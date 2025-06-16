import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Auth Pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import Register from './pages/auth/Register';
import ConfirmEmail from './pages/auth/ConfirmEmail';
import ResetPassword from './pages/auth/ResetPassword';
import AuthCallback from './pages/auth/AuthCallback';

// Dashboard Pages
import Dashboard from './pages/dashboard/Dashboard';
import DadosConexao from './pages/dashboard/DadosConexao';
import Configuracoes from './pages/dashboard/Configuracoes';
import Players from './pages/dashboard/Players';
import GerenciarVideos from './pages/dashboard/Gerenciarvideos';
import Playlists from './pages/dashboard/Playlists';
import Agendamentos from './pages/dashboard/Agendamentos';
import Comerciais from './pages/dashboard/Comerciais';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Componente que redireciona baseado na autenticação
const RedirectToProperPlace = () => {
  const { user } = useAuth();
  return <Navigate to={user ? '/dashboard' : '/login'} />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Auth Routes */}
          <Route path="/" element={<AuthLayout />}>
            <Route index element={<RedirectToProperPlace />} />
            <Route path="login" element={<Login />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="register" element={<Register />} />
            <Route path="confirm" element={<ConfirmEmail />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="auth/callback" element={<AuthCallback />} />
          </Route>

          {/* Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="dados-conexao" element={<DadosConexao />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="players" element={<Players />} />
            <Route path="gerenciarvideos" element={<GerenciarVideos />} />
            <Route path="playlists" element={<Playlists />} />
            <Route path="agendamentos" element={<Agendamentos />} /> 
            <Route path="comerciais" element={<Comerciais />} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} theme="colored" />
      </AuthProvider>
    </Router>
  );
}

export default App;