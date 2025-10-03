# 🎥 Configuração do yt-dlp para Download do YouTube

## O que é o yt-dlp?

O **yt-dlp** é uma ferramenta de linha de comando para baixar vídeos do YouTube e outras plataformas. É necessário instalá-lo no servidor para que o recurso de "Download do YouTube" funcione.

---

## ⚡ Instalação Rápida

Execute este comando no servidor onde o backend está rodando:

```bash
./install-yt-dlp.sh
```

**Este script irá:**
- ✅ Verificar se o yt-dlp já está instalado
- ✅ Tentar instalar via pip (método preferido)
- ✅ Tentar instalar via apt-get (Ubuntu/Debian)
- ✅ Fazer download direto do GitHub se necessário
- ✅ Atualizar para versão mais recente se já instalado

---

## 📦 Instalação Manual

### Método 1: Via pip (Recomendado)

```bash
# Se você tem Python 3
pip3 install yt-dlp

# Se você tem Python 2 ou pip genérico
pip install yt-dlp
```

### Método 2: Via apt-get (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y yt-dlp
```

### Método 3: Download direto do GitHub

```bash
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Método 4: Via snap

```bash
sudo snap install yt-dlp
```

---

## ✅ Verificar Instalação

Após instalar, verifique se funcionou:

```bash
yt-dlp --version
```

Você deve ver algo como:
```
2024.03.10
```

---

## 🔄 Atualizar yt-dlp

Para manter o yt-dlp atualizado:

```bash
# Se instalado via pip
pip install --upgrade yt-dlp

# Se instalado via apt-get
sudo apt-get update && sudo apt-get upgrade yt-dlp

# Se instalado via download direto
sudo yt-dlp -U
```

---

## 🐛 Solução de Problemas

### Erro: "spawn yt-dlp ENOENT"

**Causa:** O yt-dlp não está instalado ou não está no PATH do sistema.

**Solução:**
1. Execute o script de instalação: `./install-yt-dlp.sh`
2. Ou instale manualmente usando um dos métodos acima
3. Reinicie o servidor backend após instalação

### Erro: "Permission denied"

**Causa:** Falta permissão de execução.

**Solução:**
```bash
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Erro: "yt-dlp: command not found"

**Causa:** O yt-dlp não está no PATH do sistema.

**Solução:**
```bash
# Verifique onde o yt-dlp foi instalado
which yt-dlp

# Se não encontrar, tente reinstalar
pip3 install --upgrade yt-dlp

# Ou adicione ao PATH manualmente
export PATH="$PATH:/usr/local/bin"
```

### Erro ao baixar vídeos específicos

**Causa:** O YouTube pode bloquear ou limitar downloads.

**Solução:**
1. Atualize o yt-dlp: `pip install --upgrade yt-dlp`
2. Verifique se o vídeo é público e não está restrito por região
3. Alguns vídeos podem estar protegidos e não podem ser baixados

---

## 📋 Requisitos do Sistema

- **Python 3.7+** (recomendado)
- **ffmpeg** (para conversão de formatos)
- **Acesso à internet** para download dos vídeos

### Instalar ffmpeg (se necessário)

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg

# Verificar instalação
ffmpeg -version
```

---

## 🎯 Como Usar no Sistema

1. **Instale o yt-dlp** usando um dos métodos acima
2. **Acesse** "Download do YouTube" no dashboard
3. **Cole a URL** do vídeo do YouTube
4. **Selecione a qualidade** desejada
5. **Clique em "Baixar Vídeo"**
6. **Aguarde** o download e upload para o servidor

---

## 📚 Recursos Adicionais

- [Documentação oficial do yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [Lista de formatos suportados](https://github.com/yt-dlp/yt-dlp#format-selection)
- [FAQ do yt-dlp](https://github.com/yt-dlp/yt-dlp/wiki/FAQ)

---

## ⚠️ Aviso Legal

O download de vídeos do YouTube deve respeitar:
- Os Termos de Serviço do YouTube
- Direitos autorais do conteúdo
- Legislação local sobre direitos autorais

Use esta funcionalidade apenas para:
- Vídeos que você tem direito de baixar
- Conteúdo de domínio público
- Vídeos onde você tem permissão explícita do autor
