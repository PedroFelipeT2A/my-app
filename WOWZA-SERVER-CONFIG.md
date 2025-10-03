# Configuração dos Servidores Wowza

## Estrutura da Tabela `wowza_servers`

A tabela `wowza_servers` armazena as configurações de todos os servidores Wowza Streaming Engine disponíveis no sistema.

### Campos Principais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `codigo` | INT(10) | ID único do servidor (chave primária) |
| `nome` | VARCHAR(255) | Nome descritivo do servidor |
| `ip` | VARCHAR(45) | Endereço IP do servidor (único) |
| `dominio` | VARCHAR(255) | Domínio do servidor (opcional, priorizado sobre IP) |
| `porta_ssh` | INT(6) | Porta SSH (padrão: 22) |
| `porta_api` | INT(11) | Porta da API REST do Wowza (padrão: 8087) |
| `usuario_api` | VARCHAR(100) | Usuário da API REST (padrão: 'admin') |
| `senha_api` | VARCHAR(255) | Senha da API REST do Wowza |
| `senha_root` | VARCHAR(255) | Senha root SSH do servidor |
| `caminho_home` | VARCHAR(255) | Caminho home do servidor (padrão: '/home') |
| `limite_streamings` | INT(10) | Limite de streamings simultâneos (padrão: 100) |
| `streamings_ativas` | INT(10) | Contador de streamings ativas no momento |
| `tipo_servidor` | ENUM | Tipo: 'principal', 'secundario', 'unico' |
| `servidor_principal_id` | INT(10) | ID do servidor principal (para secundários) |
| `status` | ENUM | Status: 'ativo', 'inativo', 'manutencao' |
| `load_cpu` | INT(3) | Carga da CPU em % |
| `trafego_rede_atual` | DECIMAL(10,2) | Tráfego de rede atual em Mbps |
| `trafego_mes` | DECIMAL(15,2) | Tráfego total do mês em GB |
| `grafico_trafego` | TINYINT(1) | Habilitar gráficos de tráfego |
| `data_criacao` | DATETIME | Data de criação do registro |
| `data_atualizacao` | DATETIME | Última atualização |
| `ultima_sincronizacao` | DATETIME | Última sincronização com o servidor |

## Como Usar no Código

### 1. Buscar Configurações do Servidor

```javascript
const [serverRows] = await db.execute(
  `SELECT ip, dominio, porta_api, usuario_api, senha_api
   FROM wowza_servers
   WHERE codigo = ? AND status = 'ativo'`,
  [serverId]
);

const server = serverRows[0];
const wowzaHost = server.dominio || server.ip; // Priorizar domínio
const wowzaPort = server.porta_api || 8087;
const wowzaUser = server.usuario_api || 'admin';
const wowzaPassword = server.senha_api || 'admin';
```

### 2. Construir URL da API Wowza

```javascript
const apiUrl = `http://${wowzaHost}:${wowzaPort}/v2/servers/_defaultServer_/...`;

const auth = Buffer.from(`${wowzaUser}:${wowzaPassword}`).toString('base64');

const response = await fetch(apiUrl, {
  headers: {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});
```

### 3. Buscar Servidor do Usuário

```javascript
// Via tabela streamings
const [streamingRows] = await db.execute(
  'SELECT codigo_servidor, usuario FROM streamings WHERE codigo_cliente = ? LIMIT 1',
  [userId]
);

const serverId = streamingRows[0]?.codigo_servidor || 1;
```

### 4. JOIN com wowza_servers

```javascript
const [rows] = await db.execute(
  `SELECT ws.ip, ws.dominio, ws.porta_api, ws.usuario_api, ws.senha_api,
          s.usuario as user_login
   FROM wowza_servers ws
   JOIN streamings s ON ws.codigo = COALESCE(s.codigo_servidor, 1)
   WHERE s.codigo_cliente = ? AND ws.status = 'ativo'
   LIMIT 1`,
  [userId]
);
```

## Endpoints da API Wowza

A API REST do Wowza usa a porta configurada em `porta_api` (padrão: 8087).

### Exemplos de Endpoints

- **Status do Servidor**: `GET /v2/servers/_defaultServer_/status`
- **Listar Aplicações**: `GET /v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications`
- **Streams Ativos**: `GET /v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/{app}/instances/_definst_/incomingstreams`
- **Criar Aplicação**: `POST /v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications`
- **Push Publish**: `POST /v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/{app}/pushpublish/mapentries`

## Tipos de Servidor

### Servidor Único (unico)
- Servidor standalone que não faz parte de uma rede
- Usa suas próprias configurações
- `servidor_principal_id` é NULL

### Servidor Principal (principal)
- Servidor master em uma arquitetura distribuída
- Outros servidores podem referenciar ele
- Pode ter `servidor_principal_id` NULL

### Servidor Secundário (secundario)
- Servidor slave que replica do principal
- `servidor_principal_id` aponta para o servidor master
- Herda algumas configurações do principal

## Migração para Adicionar Campos da API

Execute a migration em `backend/db/migration_wowza_api_credentials.sql` para adicionar os campos `usuario_api` e `senha_api` à tabela existente.

```sql
ALTER TABLE wowza_servers
ADD COLUMN IF NOT EXISTS `usuario_api` VARCHAR(100) NULL DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS `senha_api` VARCHAR(255) NULL DEFAULT NULL;
```

## Configuração Padrão

Se não houver servidor configurado, o sistema usa valores padrão:

```javascript
{
  ip: '51.222.156.223',
  porta_api: 8087,
  usuario_api: 'admin',
  senha_api: 'admin'
}
```

## Boas Práticas

1. **Sempre usar domínio quando disponível**: `server.dominio || server.ip`
2. **Sempre verificar status = 'ativo'** nas queries
3. **Usar COALESCE para fallback**: `COALESCE(s.codigo_servidor, 1)`
4. **Armazenar senhas de forma segura** (considerar hash/encrypt)
5. **Atualizar `data_atualizacao`** automaticamente via trigger
6. **Monitorar `streamings_ativas`, `load_cpu` e `trafego_rede_atual`** para balanceamento
