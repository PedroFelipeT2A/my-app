const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// GET /api/player-port/iframe - Player iFrame na porta do sistema
router.get('/iframe', async (req, res) => {
  try {
    const { 
      stream, 
      playlist, 
      video, 
      player_type = 'html5', 
      login, 
      vod, 
      aspectratio = '16:9', 
      autoplay = 'false', 
      muted = 'false', 
      loop = 'false', 
      contador = 'false', 
      compartilhamento = 'false', 
      player = '1' 
    } = req.query;

    let videoUrl = '';
    let title = 'Player';
    let isLive = false;
    
    // Corrigir userLogin - garantir que seja string válida
    let userLogin = 'usuario';
    if (login && typeof login === 'string' && login.trim() && !login.includes('http')) {
      userLogin = login.trim();
    }
    
    let vodPath = vod || '';
    let playlistId = playlist || '';

    console.log('🎥 Player iFrame request:', {
      login,
      stream,
      playlist,
      video,
      vod,
      userLogin
    });

    // Construir URL baseado nos parâmetros
    if (vodPath) {
      // VOD específico
      const wowzaHost = 'stmv1.udicast.com';

      // Garantir que o arquivo é MP4
      const vodPathParts = vodPath.split('/');
      if (vodPathParts.length >= 2) {
        const folderName = vodPathParts[0];
        const fileName = vodPathParts[1];
        const finalFileName = fileName.endsWith('.mp4') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp4');
        videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}/mp4:${folderName}/${finalFileName}/playlist.m3u8`;
      } else {
        videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}/mp4:default/${vodPath}/playlist.m3u8`;
      }

      title = `VOD: ${vodPath}`;
      isLive = false;
    } else if (playlistId) {
      try {
        console.log(`🔍 Verificando transmissão ativa para playlist ${playlistId}...`);
        
        // Buscar playlist no banco
        const [playlistRows] = await db.execute(
          'SELECT nome FROM playlists WHERE id = ?',
          [playlistId]
        );
        
        if (playlistRows.length > 0) {
          const wowzaHost = 'stmv1.udicast.com';
          videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`;
          title = `Playlist: ${playlistRows[0].nome}`;
          isLive = true;
        }
      } catch (error) {
        console.error("Erro ao verificar playlist:", error);
      }
    }

    if (stream) {
      // Stream ao vivo
      const wowzaHost = 'stmv1.udicast.com';

      // Verificar se é stream de playlist ou OBS
      if (stream.includes('_playlist')) {
        // Stream de playlist - usar aplicação específica do usuário
        const userFromStream = stream.replace('_playlist', '');
        videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`;
      } else {
        // Stream OBS - usar aplicação específica do usuário
        videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`;
      }
      title = `Stream: ${stream}`;
      isLive = true;
    } else if (userLogin && userLogin !== 'usuario') {
      // Playlist específica
      try {
        const wowzaHost = 'stmv1.udicast.com';
        // Definir URL padrão OBS
        videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`;

        title = `Stream OBS - ${userLogin}`;

        isLive = true;
      } catch (error) {
        console.error('Erro ao buscar playlist específica:', error);
        videoUrl = '';
        title = `Erro no Stream - ${userLogin}`;
        isLive = false;
      }
    }


    if (!videoUrl && userLogin && userLogin !== 'usuario') {
      try {
        const wowzaHost = 'stmv1.udicast.com';
        videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}/playlist.m3u8`;
        title = `Stream: ${userLogin}`;
        isLive = true;
      } catch (error) {
        console.error('Erro ao carregar playlist:', error);
      }
    }

    if (video) {
      try {
        if (typeof video === 'string' && video.trim()) {
          const [videoRows] = await db.execute(
            'SELECT url, nome, caminho FROM videos WHERE id = ?',
            [video]
          );

          if (videoRows.length > 0) {
            const videoData = videoRows[0];
            let videoPath = videoData.url || videoData.caminho;

            // Construir URL HLS do Wowza
            if (videoPath && !videoPath.startsWith('http')) {
              const cleanPath = videoPath.replace(/^\/?(home\/streaming\/|content\/|streaming\/)?/, '');
              const pathParts = cleanPath.split('/');

              if (pathParts.length >= 3) {
                const userPath = pathParts[0];
                const folderName = pathParts[1];
                const fileName = pathParts[2];
                const finalFileName = fileName.endsWith('.mp4') ? fileName : fileName.replace(/\.[^/.]+$/, '.mp4');

                const wowzaHost = 'stmv1.udicast.com';
                videoUrl = `https://${wowzaHost}/${userPath}/${userPath}/mp4:${folderName}/${finalFileName}/playlist.m3u8`;
              } else {
                videoUrl = `/content/${videoPath}`;
              }
            } else {
              videoUrl = videoPath;
            }

            title = videoRows[0].nome;
          }
        }
      } catch (error) {
        console.error('Erro ao carregar vídeo:', error);
      }
    }

    if (!videoUrl && userLogin && userLogin !== 'usuario') {
      // Stream padrão do usuário
      const wowzaHost = 'stmv1.udicast.com';
      videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}_live/playlist.m3u8`;
      title = `Stream: ${userLogin}`;
      isLive = true;
    }


    console.log('🎬 Player URL construída:', {
      videoUrl,
      title,
      isLive,
      userLogin,
      hasPlaylistTransmission: false,
      hasOBSTransmission: false
    });

    // Gerar HTML do player
    const playerHTML = generatePlayerHTML({
      videoUrl,
      title,
      isLive,
      aspectRatio: aspectratio,
      autoplay: autoplay === 'true',
      muted: muted === 'true',
      loop: loop === 'true',
      showCounter: contador === 'true',
      showSharing: compartilhamento === 'true',
      playerType: parseInt(player) || parseInt(player_type) || 1,
      userLogin
    });

    console.log('✅ Enviando HTML do player');

    res.setHeader('Content-Type', 'text/html');
    res.send(playerHTML);

  } catch (error) {
    console.error('Erro no player iframe:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Erro no Player</title></head>
            <body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:Arial">
              <div style="text-align:center">
                <h2>Erro no Player</h2>
                <p>Não foi possível carregar o conteúdo solicitado.</p>
              </div>
            </body>
            </html>
        `);
  }
});

// Função para gerar HTML do player baseado no video.php
// Função para gerar o HTML do player
function generatePlayerHTML({
  videoUrl,
  title,
  aspectRatio = "16:9",
  autoplay = false,
  muted = false,
  loop = false,
  contador = false,
  compartilhamento = false,
  playerType = "html5",
  isLive = false,
}) {
  const autoplayAttr = autoplay ? "autoplay" : "";
  const mutedAttr = muted ? "muted" : "";
  const loopAttr = loop ? "loop" : "";

  // Se não há videoUrl, mostrar tela de "sem sinal" como no PHP
  if (!videoUrl) {
    return `
      <!DOCTYPE html>
      <html lang="pt-br">
      <head>
        <meta charset="utf-8">
        <title>Sem sinal | No signal</title>
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            background: #000; 
            color: white; 
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
          }
          .no-signal {
            text-align: center;
          }
          .signal-bars {
            display: inline-block;
            margin: 20px 0;
          }
          .bar {
            display: inline-block;
            width: 8px;
            height: 30px;
            background: #333;
            margin: 0 2px;
            animation: signal-fade 2s infinite;
          }
          .bar:nth-child(2) { animation-delay: 0.2s; }
          .bar:nth-child(3) { animation-delay: 0.4s; }
          .bar:nth-child(4) { animation-delay: 0.6s; }
          .bar:nth-child(5) { animation-delay: 0.8s; }
          @keyframes signal-fade {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        </style>
      </head>
      <body>
        <div class="no-signal">
          <h2>SEM SINAL</h2>
          <div class="signal-bars">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
          <p>No Signal</p>
          <p style="font-size: 0.8em; opacity: 0.7;">Recarregando automaticamente...</p>
        </div>
        <script>
          setTimeout(function() { 
            location.reload(); 
          }, 10000);
        </script>
      </body>
      </html>
    `;
  }
  if (playerType === "videojs") {
    return `
      <!DOCTYPE html>
      <html lang="pt-br">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <link href="//vjs.zencdn.net/7.8.4/video-js.css" rel="stylesheet" />
        <style>
          body, html { margin:0; padding:0; height:100%; width:100%; background:black; }
          .video-js { height:100%; width:100%; }
          ${contador ? '.icone-contador { position: absolute; left: 10px; top: 10px; background: rgba(255,0,0,1); color: white; padding: 5px 10px; border-radius: 3px; font-size: 14px; z-index: 10000; }' : ''}
        </style>
      </head>
      <body>
        ${contador ? '<div class="icone-contador"><i class="fa fa-eye"></i> <strong><span id="contador_online">0</span></strong></div>' : ''}
        
        <video id="player_webtv" class="video-js vjs-fluid vjs-default-skin"
          ${autoplayAttr} ${mutedAttr} ${loopAttr} controls preload="none"
          width="100%" height="100%"
          data-setup='{ "fluid":true,"aspectRatio":"${aspectRatio}" }'>
          <source src="${videoUrl}" type="application/x-mpegURL">
        </video>

        <script src="//vjs.zencdn.net/7.8.4/video.js"></script>
        <script src="//cdnjs.cloudflare.com/ajax/libs/videojs-contrib-hls/5.12.0/videojs-contrib-hls.min.js"></script>
        <script src="//cdnjs.cloudflare.com/ajax/libs/videojs-contrib-quality-levels/2.0.9/videojs-contrib-quality-levels.min.js"></script>
        <script src="//unpkg.com/videojs-hls-quality-selector@1.1.4/dist/videojs-hls-quality-selector.min.js"></script>

        <script>
          var player = videojs('player_webtv', {
            hls: { overrideNative: true }
          });
          player.hlsQualitySelector({ displayCurrentQuality: true });

          player.on("pause", function () {
            player.one("play", function () {
              player.load();
              player.play();
            });
          });

          ${contador ? `
          function contador() {
            var count = Math.floor(Math.random() * 50) + 5;
            var counter = document.getElementById('contador_online');
            if (counter) counter.textContent = count;
          }
          contador();
          setInterval(contador, 30000);
          ` : ''}

          ${isLive ? `
          player.on('error', function() {
            setTimeout(function() { location.reload(); }, 10000);
          });
          ` : ""}
        </script>
      </body>
      </html>
    `;
  }

  // Player HTML5 padrão
  return `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body, html { margin:0; padding:0; height:100%; width:100%; background:black; }
        video { width:100%; height:100%; }
        ${contador ? '.counter { position: absolute; top: 10px; left: 10px; background: rgba(255,0,0,0.8); color: white; padding: 5px 10px; border-radius: 3px; font-size: 14px; z-index: 1000; }' : ''}
      </style>
    </head>
    <body>
      ${contador ? '<div class="counter"><i class="fa fa-eye"></i> <span id="viewer-count">0</span></div>' : ''}
      <video ${autoplayAttr} ${mutedAttr} ${loopAttr} controls>
        <source src="${videoUrl}" type="application/x-mpegURL">
      </video>
      
      <script>
        ${contador ? `
        function updateCounter() {
          const count = Math.floor(Math.random() * 50) + 5;
          const counter = document.getElementById('viewer-count');
          if (counter) counter.textContent = count;
        }
        updateCounter();
        setInterval(updateCounter, 30000);
        ` : ''}
        
        ${isLive ? `
        // Auto-reload em caso de erro para streams ao vivo
        const video = document.querySelector('video');
        video.addEventListener('error', function() {
          setTimeout(function() { location.reload(); }, 10000);
        });
        ` : ''}
      </script>
    </body>
    </html>
  `;
}

// ==========================
// ROTA PRINCIPAL DO PLAYER
// ==========================
router.get("/iframe", async (req, res) => {
  try {
    const {
      stream,
      playlist,
      video,
      player_type = "html5",
      login,
      vod,
      aspectratio = "16:9",
      autoplay = "false",
      muted = "false",
      loop = "false",
      contador = "false",
      compartilhamento = "false",
      player = "1",
    } = req.query;

    let videoUrl = "";
    let title = "Player";
    let isLive = false;
    let userLogin = typeof login === 'string' ? login.trim() : 'usuario';
    
    // Validar e limpar userLogin
    if (!userLogin || userLogin === 'usuario' || userLogin.includes('http') || userLogin.includes(':')) {
      console.warn('⚠️ userLogin inválido detectado:', userLogin);
      userLogin = 'usuario';
    }

    const wowzaHost = "stmv1.udicast.com";

    // Caso VOD
    if (vod) {
      const parts = vod.split("/");
      if (parts.length >= 2) {
        const folder = parts[0];
        const file = parts[1].endsWith(".mp4")
          ? parts[1]
          : parts[1].replace(/\.[^/.]+$/, ".mp4");
        videoUrl = `https://${wowzaHost}/vod/_definst_/mp4:${userLogin}/${folder}/${file}/playlist.m3u8`;
      }
      title = `VOD: ${vod}`;
      isLive = false;
    }

    // Caso Stream OBS
    else if (stream) {
      videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}_live/playlist.m3u8`;
      title = `Stream OBS - ${userLogin}`;
      isLive = true;
    }

    // Caso Playlist
    else if (playlist) {
      try {
        if (typeof playlist === 'string' && playlist.trim()) {
          const [rows] = await db.execute(
            "SELECT nome FROM playlists WHERE id = ?",
            [playlist]
          );

          if (rows.length > 0) {
            title = `Playlist: ${rows[0].nome}`;
          } else {
            title = `Playlist Offline - ${playlist}`;
          }
        }
      } catch (dbError) {
        console.error('Erro ao buscar playlist:', dbError);
        title = `Playlist - ${playlist}`;
      }

      videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}_live/playlist.m3u8`;
      isLive = true;
    }

    // Fallback padrão OBS
    else {
      videoUrl = `https://${wowzaHost}/${userLogin}/${userLogin}_live/playlist.m3u8`;
      title = `Stream OBS - ${userLogin}`;
      isLive = true;
    }

    const html = generatePlayerHTML({
      videoUrl,
      title,
      aspectRatio: aspectratio,
      autoplay: autoplay === "true",
      muted: muted === "true",
      loop: loop === "true",
      contador: contador === "true",
      compartilhamento: compartilhamento === "true",
      playerType: player_type,
      isLive,
    });

    res.send(html);
  } catch (err) {
    console.error("Erro no player iframe:", err);
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Erro no Player</title></head>
        <body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:Arial">
          <div style="text-align:center">
            <h2>Erro no Player</h2>
            <p>Não foi possível carregar o conteúdo solicitado.</p>
          </div>
        </body>
        </html>
    `);
  }
});

module.exports = router;