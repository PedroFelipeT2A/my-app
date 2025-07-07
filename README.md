# Sistema de Streaming - Migração MySQL

Este projeto foi migrado do Supabase para MySQL usando as tabelas do banco `db_SamCast`.

## Configuração do Banco de Dados

### Conexão MySQL
- **Host:** 104.251.209.68
- **Porta:** 35689
- **Usuário:** root
- **Senha:** Adr1an@
- **Database:** db_SamCast

### Tabelas Principais
- **revendas:** Tabela de usuários do sistema
- **playlists:** Playlists de vídeos
- **playlists_videos:** Vídeos das playlists
- **streamings:** Configurações de streaming (usado como pastas)

## Estrutura do Projeto

### Backend (`/backend`)
- **config/database.js:** Configuração da conexão MySQL
- **middlewares/authMiddleware.js:** Middleware de autenticação JWT
- **routes/:** Rotas da API
  - `auth.js` - Autenticação (login, registro, etc.)
  - `folders.js` - Gerenciamento de pastas
  - `videos.js` - Upload e gerenciamento de vídeos
  - `playlists.js` - Gerenciamento de playlists

### Frontend (`/src`)
- **context/AuthContext.tsx:** Contexto de autenticação atualizado para MySQL
- Componentes React mantidos com adaptações para nova API

## Funcionalidades

### Autenticação
- Login com email/senha usando tabela `revendas`
- Registro de novos usuários
- JWT para autenticação
- Middleware de proteção de rotas

### Gerenciamento de Vídeos
- Upload de vídeos para o Wowza
- Organização por pastas (baseado na tabela `streamings`)
- Cada usuário tem sua pasta no Wowza: `/usr/local/WowzaStreamingEngine/content/{userEmail}/`
- Suporte a formatos: MP4, AVI, MOV, WMV, FLV, WebM, MKV

### Playlists
- Criação e edição de playlists
- Organização de vídeos por ordem
- Integração com sistema de agendamentos

## Como Executar

### Pré-requisitos
- Node.js 18+
- Acesso ao banco MySQL configurado
- Servidor Wowza configurado

### Instalação
```bash
# Instalar dependências do frontend
npm install

# Instalar dependências do backend
cd backend
npm install
cd ..
```

### Executar em Desenvolvimento
```bash
# Executar frontend e backend simultaneamente
npm run dev

# Ou executar separadamente:
npm run dev:frontend  # Frontend na porta 3000
npm run dev:backend   # Backend na porta 3001
```

### URLs
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/api
- **Health Check:** http://localhost:3001/api/health

## Estrutura de Pastas no Wowza

```
/usr/local/WowzaStreamingEngine/content/
├── usuario1/
│   ├── pasta1/
│   │   ├── video1.mp4
│   │   └── video2.mp4
│   └── pasta2/
│       └── video3.mp4
└── usuario2/
    └── default/
        └── video4.mp4
```

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/forgot-password` - Recuperar senha
- `GET /api/auth/me` - Dados do usuário logado

### Pastas
- `GET /api/folders` - Listar pastas
- `POST /api/folders` - Criar pasta
- `DELETE /api/folders/:id` - Remover pasta

### Vídeos
- `GET /api/videos?folder_id=X` - Listar vídeos da pasta
- `POST /api/videos/upload?folder_id=X` - Upload de vídeo
- `DELETE /api/videos/:id` - Remover vídeo

### Playlists
- `GET /api/playlists` - Listar playlists
- `POST /api/playlists` - Criar playlist
- `GET /api/playlists/:id/videos` - Vídeos da playlist
- `PUT /api/playlists/:id` - Atualizar playlist
- `DELETE /api/playlists/:id` - Remover playlist

## Segurança

- Autenticação JWT
- Validação de propriedade de recursos
- Sanitização de nomes de arquivos
- Validação de tipos de arquivo
- Middleware de tratamento de erros

## Observações

1. **Migração de Dados:** Os dados existentes no Supabase precisam ser migrados manualmente para o MySQL
2. **Wowza:** Certifique-se de que o servidor Wowza está configurado e acessível
3. **Permissões:** O servidor precisa ter permissões de escrita na pasta do Wowza
4. **Backup:** Sempre faça backup dos dados antes de executar migrações

## Próximos Passos

1. Implementar outras funcionalidades (agendamentos, comerciais, etc.)
2. Adicionar sistema de logs
3. Implementar monitoramento de espaço em disco
4. Adicionar compressão de vídeos
5. Implementar sistema de notificações