# Correções Aplicadas

## Problemas Corrigidos

### 1. ✅ Vídeos Não Aparecem para Adicionar em Playlists

**Problema:** O filtro estava muito restritivo, exigindo que os vídeos fossem MP4 E tivessem bitrate dentro do limite E estivessem marcados como compatíveis.

**Solução:** Ajustado o filtro em `src/pages/dashboard/Playlists.tsx` para aceitar vídeos que:
- São MP4 **OU**
- Estão marcados como otimizados

Agora todos os vídeos MP4 ou otimizados aparecem na lista para adicionar à playlist.

---

### 2. ✅ Conversão de Vídeos Permite Todos os Vídeos

**Problema:** Apenas vídeos não compatíveis eram mostrados para conversão.

**Solução:** Modificado `backend/routes/conversion.js` para:
- Remover filtro de compatibilidade na query SQL
- Marcar todos os vídeos como `needs_conversion: true`
- Permitir conversão mesmo de vídeos já otimizados (caso usuário queira mudar qualidade)

Agora é possível converter qualquer vídeo, mesmo os que já estão otimizados.

---

### 3. ✅ Erro yt-dlp: spawn yt-dlp ENOENT

**Problema:** O yt-dlp não está instalado no servidor.

**Solução:**

#### Criado Script de Instalação
```bash
./install-yt-dlp.sh
```

Este script tenta instalar o yt-dlp usando vários métodos:
1. Via pip3/pip
2. Via apt-get (Ubuntu/Debian)
3. Download direto do GitHub

#### Adicionada Verificação no Código
O código agora verifica se o yt-dlp está disponível antes de usá-lo e retorna mensagem de erro clara se não estiver instalado.

---

## Como Instalar o yt-dlp

### Opção 1: Usar o Script Automático (Recomendado)
```bash
cd /tmp/cc-agent/57859390/project
chmod +x install-yt-dlp.sh
./install-yt-dlp.sh
```

### Opção 2: Instalação Manual

#### Via pip (Método Preferido)
```bash
pip install yt-dlp
# ou
pip3 install yt-dlp
```

#### Via apt (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install yt-dlp
```

#### Download Direto
```bash
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Verificar Instalação
```bash
yt-dlp --version
```

---

## Testando as Correções

### 1. Testar Playlists
1. Acesse "Gerenciar Playlists"
2. Selecione uma pasta com vídeos
3. Verifique se os vídeos MP4 aparecem na lista de vídeos disponíveis
4. Adicione vídeos à playlist usando o botão "+"

### 2. Testar Conversão
1. Acesse "Conversão de Vídeos"
2. Selecione uma pasta
3. Verifique se TODOS os vídeos aparecem na lista (inclusive os já otimizados)
4. Tente converter um vídeo já otimizado para outra qualidade

### 3. Testar Download do YouTube
1. Instale o yt-dlp usando o script: `./install-yt-dlp.sh`
2. Acesse "Download do YouTube"
3. Cole uma URL do YouTube
4. Clique em "Baixar Vídeo"
5. O download deve iniciar sem erro "spawn yt-dlp ENOENT"

---

## Arquivos Modificados

1. `src/pages/dashboard/Playlists.tsx`
   - Linha 288-306: Ajustado filtro de vídeos disponíveis

2. `backend/routes/conversion.js`
   - Linha 22-26: Removido filtro de compatibilidade
   - Linha 75-92: Ajustada lógica de compatibilidade
   - Linha 155: Marcado todos como `needs_conversion: true`

3. `backend/config/YouTubeDownloader.js`
   - Linha 55-73: Adicionada verificação se yt-dlp está instalado
   - Linha 211-226: Adicionada verificação antes do download

4. `install-yt-dlp.sh` (NOVO)
   - Script de instalação automática do yt-dlp

---

## Notas Importantes

- **yt-dlp é obrigatório** para o download de vídeos do YouTube funcionar
- Os vídeos otimizados podem ser reconvertidos se necessário (ex: mudar resolução/bitrate)
- O filtro de playlists agora é mais permissivo, mas ainda mantém qualidade mínima (MP4 ou otimizado)
