#!/bin/bash

# Script para instalar yt-dlp no servidor
# Execute este script no servidor onde o backend está rodando

echo "🚀 Instalando yt-dlp para download de vídeos do YouTube..."

# Verificar se já está instalado
if command -v yt-dlp &> /dev/null; then
    echo "✅ yt-dlp já está instalado"
    yt-dlp --version
    echo ""
    echo "📦 Atualizando yt-dlp para versão mais recente..."
    pip install --upgrade yt-dlp
    exit 0
fi

# Tentar instalar via pip (método preferido)
if command -v pip3 &> /dev/null; then
    echo "📦 Instalando via pip3..."
    pip3 install yt-dlp

    if command -v yt-dlp &> /dev/null; then
        echo "✅ yt-dlp instalado com sucesso via pip3!"
        yt-dlp --version
        exit 0
    fi
fi

if command -v pip &> /dev/null; then
    echo "📦 Instalando via pip..."
    pip install yt-dlp

    if command -v yt-dlp &> /dev/null; then
        echo "✅ yt-dlp instalado com sucesso via pip!"
        yt-dlp --version
        exit 0
    fi
fi

# Tentar instalar via apt (Ubuntu/Debian)
if command -v apt-get &> /dev/null; then
    echo "📦 Instalando via apt-get..."
    sudo apt-get update
    sudo apt-get install -y yt-dlp

    if command -v yt-dlp &> /dev/null; then
        echo "✅ yt-dlp instalado com sucesso via apt-get!"
        yt-dlp --version
        exit 0
    fi
fi

# Download direto do GitHub (método alternativo)
echo "📦 Tentando instalação direta do GitHub..."
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

if command -v yt-dlp &> /dev/null; then
    echo "✅ yt-dlp instalado com sucesso do GitHub!"
    yt-dlp --version
    exit 0
fi

echo "❌ Falha ao instalar yt-dlp. Tente instalar manualmente:"
echo "   pip install yt-dlp"
echo "   ou"
echo "   sudo apt-get install yt-dlp"
exit 1
