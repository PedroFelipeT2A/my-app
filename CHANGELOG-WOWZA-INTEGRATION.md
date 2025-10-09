# Changelog - Integração com Tabela wowza_servers

## Resumo das Alterações

Ajustes realizados para usar corretamente os dados da tabela `wowza_servers` conforme sua estrutura oficial.

## Problemas Corrigidos

### 1. Erro: `transmissionStatus is not defined` ✅
**Arquivo**: `src/pages/dashboard/IniciarTransmissao.tsx`

**Problema**: Variável `transmissionStatus` estava sendo usada sem ser declarada na linha 142.

**Solução**:
- Adicionada interface `TransmissionStatus`
- Declarado estado `transmissionStatus` com `useState`
- Criada função `checkTransmissionStatus()` para buscar status da API
- Função adicionada ao `loadInitialData()`

### 2. Erro 400: Playlist sem vídeos (mas tinha vídeos) ✅
**Arquivo**: `backend/routes/streaming-control.js`

**Problema**: Query SQL buscava vídeos diretamente na tabela `videos` usando `playlist_id`, mas a estrutura correta usa tabela de relacionamento `playlist_videos`.

**Solução**:
```sql
-- ANTES (incorreto)
SELECT COUNT(*) as total FROM videos
WHERE playlist_id = ? AND codigo_cliente = ?

-- DEPOIS (correto)
SELECT COUNT(*) as total FROM playlist_videos pv
INNER JOIN videos v ON pv.video_id = v.id
WHERE pv.playlist_id = ? AND v.codigo_cliente = ?
```

### 3. Campos inexistentes: `usuario_api` e `senha_api` ✅

**Problema**: Código estava tentando acessar campos `usuario_api` e `senha_api` que não existiam na tabela `wowza_servers`.

**Solução**:
1. Criada migration SQL em `backend/db/migration_wowza_api_credentials.sql` para adicionar campos:
   - `usuario_api VARCHAR(100)` - Usuário da API REST
   - `senha_api VARCHAR(255)` - Senha da API REST

2. Ajustadas todas as queries para usar os novos campos

## Arquivos Modificados

### Backend

#### 1. `backend/routes/streaming-control.js`
- **Linha 360-364**: Corrigida query de validação de vídeos da playlist
- **Linha 697**: Query busca agora `usuario_api` e `senha_api`
- **Linha 713**: Senha padrão alterada de 'password' para 'admin'
- **Linha 789**: Query busca também `porta_api`

#### 2. `backend/config/WowzaStreamingService.js`
- **Linha 17**: Query agora busca `porta_api, usuario_api, senha_api`
- **Linha 27-29**: Servidor padrão usa porta 8087 e senha 'admin'
- **Linha 31-36**: Usa corretamente `porta_api`, `usuario_api` e `senha_api` do banco

#### 3. `backend/config/WowzaLiveManager.js`
- **Linha 17**: Query atualizada para buscar credenciais da API
- **Linha 27-29**: Servidor padrão atualizado
- **Linha 31-36**: Usa campos corretos da tabela `wowza_servers`

### Frontend

#### 4. `src/pages/dashboard/IniciarTransmissao.tsx`
- **Linha 49-57**: Adicionada interface `TransmissionStatus`
- **Linha 68**: Adicionado estado `transmissionStatus`
- **Linha 162-178**: Nova função `checkTransmissionStatus()`
- **Linha 180**: Função adicionada ao `loadInitialData()`

## Novos Arquivos

### 1. `backend/db/migration_wowza_api_credentials.sql`
Migration para adicionar campos da API REST do Wowza à tabela existente.

**Campos adicionados**:
- `usuario_api` - Usuário para autenticação na API
- `senha_api` - Senha para autenticação na API

**Valores padrão**: 'admin' / 'admin'

### 2. `WOWZA-SERVER-CONFIG.md`
Documentação completa sobre:
- Estrutura da tabela `wowza_servers`
- Como usar os campos no código
- Exemplos de queries
- Endpoints da API Wowza
- Tipos de servidor (único, principal, secundário)
- Boas práticas

## Estrutura Correta da Tabela wowza_servers

```sql
CREATE TABLE wowza_servers (
  codigo INT(10) PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(255) NOT NULL,
  ip VARCHAR(45) NOT NULL UNIQUE,
  dominio VARCHAR(255) NULL,
  porta_ssh INT(6) DEFAULT 22,
  porta_api INT(11) DEFAULT 8087,
  usuario_api VARCHAR(100) DEFAULT 'admin',    -- ✨ NOVO
  senha_api VARCHAR(255) NULL,                  -- ✨ NOVO
  senha_root VARCHAR(255) NOT NULL,
  caminho_home VARCHAR(255) DEFAULT '/home',
  limite_streamings INT(10) DEFAULT 100,
  tipo_servidor ENUM('principal','secundario','unico') DEFAULT 'unico',
  servidor_principal_id INT(10) NULL,
  streamings_ativas INT(10) DEFAULT 0,
  load_cpu INT(3) DEFAULT 0,
  trafego_rede_atual DECIMAL(10,2) DEFAULT 0.00,
  trafego_mes DECIMAL(15,2) DEFAULT 0.00,
  status ENUM('ativo','inativo','manutencao') DEFAULT 'ativo',
  grafico_trafego TINYINT(1) DEFAULT 1,
  data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ultima_sincronizacao DATETIME NULL
);
```

## Como Aplicar as Mudanças

### 1. Executar Migration no Banco de Dados
```bash
mysql -u usuario -p banco < backend/db/migration_wowza_api_credentials.sql
```

### 2. Atualizar Credenciais dos Servidores
```sql
-- Atualizar credenciais da API para cada servidor
UPDATE wowza_servers
SET usuario_api = 'seu_usuario',
    senha_api = 'sua_senha'
WHERE codigo = 1;
```

### 3. Reiniciar Backend
```bash
cd backend
node server.js
```

## Comportamento Padrão

Se os campos `usuario_api` ou `senha_api` estiverem NULL ou vazios:
- **Usuário**: 'admin'
- **Senha**: 'admin'

Se não houver servidor configurado, usa servidor padrão:
- **Host**: 51.222.156.223
- **Porta API**: 8087
- **Usuário**: admin
- **Senha**: admin

## Prioridades de Conexão

1. **Domínio** (`dominio`) tem prioridade sobre IP
2. **Porta API** usa `porta_api` ou default 8087
3. **Credenciais** usam `usuario_api`/`senha_api` ou defaults

Exemplo de código:
```javascript
const wowzaHost = server.dominio || server.ip;
const wowzaPort = server.porta_api || 8087;
const wowzaUser = server.usuario_api || 'admin';
const wowzaPassword = server.senha_api || 'admin';
```

## Testes Recomendados

1. ✅ Iniciar playlist com vídeos
2. ✅ Verificar transmissão OBS ativa
3. ✅ Testar conexão com API Wowza
4. ✅ Verificar URLs do player
5. ✅ Testar múltiplos servidores

## Melhorias Futuras

1. **Segurança**: Criptografar `senha_api` e `senha_root` no banco
2. **Balanceamento**: Usar `load_cpu` e `streamings_ativas` para distribuir carga
3. **Monitoramento**: Atualizar `trafego_rede_atual` em tempo real
4. **Failover**: Implementar fallback automático para servidores secundários
5. **Cache**: Cache de configurações dos servidores para reduzir queries

## Suporte

Para mais informações, consulte:
- `WOWZA-SERVER-CONFIG.md` - Documentação da estrutura
- `backend/db/migration_wowza_api_credentials.sql` - Migration dos campos
- API Wowza: https://www.wowza.com/docs/wowza-streaming-engine-rest-api-reference
