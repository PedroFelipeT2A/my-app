import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Menu, FileVideo, LogOut, User, Settings, Bell, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '/logo.png';

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Fecha sidebar ao clicar fora, só no mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarOpen) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.contains(event.target as Node)) {
          setSidebarOpen(false);
        }
      }
    };
    if (sidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-gray-100">
      <aside
        id="sidebar"
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-md transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-auto`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center px-10 py-6 border-b">
            <img src={Logo} alt="Logo" className="h-20 w-auto mr-2" />
          </div>

          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-2">
              <li>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-gray-700 rounded-lg ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
                    }`
                  }
                  end
                >
                  <span className="mr-3">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h2a1 1 0 001-1v-7m-6 0a1 1 0 01-1-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1z"
                      />
                    </svg>
                  </span>
                  <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/dashboard/dados-conexao"
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-gray-700 rounded-lg ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
                    }`
                  }
                >
                  <span className="mr-3">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </span>
                  <span>Dados de Conexão</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/dashboard/configuracoes"
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-gray-700 rounded-lg ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
                    }`
                  }
                >
                  <span className="mr-3">
                    <Settings className="h-5 w-5" />
                  </span>
                  <span>Configurações</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/dashboard/players"
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-gray-700 rounded-lg ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
                    }`
                  }
                >
                  <span className="mr-3">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <span>Players</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/dashboard/gerenciarvideos"
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-gray-700 rounded-lg ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
                    }`
                  }
                >
                  <span className="mr-3">
                    <FileVideo className="h-5 w-5" />
                  </span>
                  <span>Vídeos</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/dashboard/playlists"
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-gray-700 rounded-lg ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
                    }`
                  }
                >
                  <span className="mr-3">
                    <FileVideo className="h-5 w-5" />
                  </span>
                  <span>Playlists</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/dashboard/agendamentos"
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-gray-700 rounded-lg ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
                    }`
                  }
                >
                  <span className="mr-3">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  <span>Agendamentos</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/dashboard/comerciais"
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-gray-700 rounded-lg ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
                    }`
                  }
                >
                  <span className="mr-3">
                    <Megaphone className="h-5 w-5" />
                  </span>
                  <span>Comerciais</span>
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="px-4 py-6 border-t">
            <button
              onClick={logout}
              className="flex items-center w-full px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <LogOut className="h-5 w-5 mr-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <button
              className="p-1 rounded-md lg:hidden focus:outline-none focus:ring-2 focus:ring-primary-500"
              onClick={toggleSidebar}
            >
              <Menu className="h-6 w-6 text-gray-600" />
            </button>
            <div className="flex items-center">
              <button className="p-1 rounded-full text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 mr-3">
                <Bell className="h-6 w-6" />
              </button>
              <div className="relative flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white">
                  <User className="h-5 w-5" />
                </div>
                <span className="ml-2 font-medium text-gray-700">{user?.nome || 'Usuário'}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;