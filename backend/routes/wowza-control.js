const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const SSHManager = require('../config/SSHManager');
const db = require('../config/database');

const router = express.Router();

// POST /api/wowza-control/start - Iniciar aplicação Wowza
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar informações do usuário
    const [userRows] = await db.execute(
      'SELECT usuario, email, codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const userData = userRows[0];
    const userLogin = userData.usuario || userData.email.split('@')[0] || `user_${userId}`;
    const serverId = userData.codigo_servidor || 1;

    console.log(`▶️ Iniciando aplicação Wowza para usuário: ${userLogin}`);

    // Comando simplificado para iniciar aplicação (usando o método sugerido)
    const command = `cd /usr/local/WowzaMediaServer && export WOWZA_HOME=/usr/local/WowzaMediaServer && /usr/bin/java -cp "lib/*:bin" com.wowza.wms.jmx.JMXCommandLine -jmx "service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi" -user admin -pass admin startAppInstance ${userLogin}`;

    // Executar comando via SSH
    const output = await SSHManager.executeCommand(serverId, command);

    console.log(`✅ Aplicação Wowza iniciada com sucesso para ${userLogin}`);
    console.log(`Output: ${output}`);

    res.json({
      success: true,
      message: `Aplicação iniciada com sucesso para ${userLogin}`,
      output: output,
      user: userLogin
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar aplicação Wowza:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao iniciar aplicação Wowza'
    });
  }
});

// POST /api/wowza-control/stop - Parar aplicação Wowza
router.post('/stop', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar informações do usuário
    const [userRows] = await db.execute(
      'SELECT usuario, email, codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const userData = userRows[0];
    const userLogin = userData.usuario || userData.email.split('@')[0] || `user_${userId}`;
    const serverId = userData.codigo_servidor || 1;

    console.log(`⏹️ Parando aplicação Wowza para usuário: ${userLogin}`);

    // Comando simplificado para parar aplicação
    const command = `cd /usr/local/WowzaMediaServer && export WOWZA_HOME=/usr/local/WowzaMediaServer && /usr/bin/java -cp "lib/*:bin" com.wowza.wms.jmx.JMXCommandLine -jmx "service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi" -user admin -pass admin shutdownAppInstance ${userLogin}`;

    // Executar comando via SSH
    const output = await SSHManager.executeCommand(serverId, command);

    console.log(`✅ Aplicação Wowza parada com sucesso para ${userLogin}`);
    console.log(`Output: ${output}`);

    res.json({
      success: true,
      message: `Aplicação parada com sucesso para ${userLogin}`,
      output: output,
      user: userLogin
    });

  } catch (error) {
    console.error('❌ Erro ao parar aplicação Wowza:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao parar aplicação Wowza'
    });
  }
});

// POST /api/wowza-control/restart - Reiniciar aplicação Wowza
router.post('/restart', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar informações do usuário
    const [userRows] = await db.execute(
      'SELECT usuario, email, codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const userData = userRows[0];
    const userLogin = userData.usuario || userData.email.split('@')[0] || `user_${userId}`;
    const serverId = userData.codigo_servidor || 1;

    console.log(`🔄 Reiniciando aplicação Wowza para usuário: ${userLogin}`);

    // Primeiro, parar a aplicação
    const stopCommand = `cd /usr/local/WowzaMediaServer && export WOWZA_HOME=/usr/local/WowzaMediaServer && /usr/bin/java -cp "lib/*:bin" com.wowza.wms.jmx.JMXCommandLine -jmx "service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi" -user admin -pass admin shutdownAppInstance ${userLogin}`;

    console.log(`⏹️ Parando aplicação primeiro...`);
    await SSHManager.executeCommand(serverId, stopCommand);

    // Aguardar 2 segundos antes de iniciar novamente
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Depois, iniciar a aplicação
    const startCommand = `cd /usr/local/WowzaMediaServer && export WOWZA_HOME=/usr/local/WowzaMediaServer && /usr/bin/java -cp "lib/*:bin" com.wowza.wms.jmx.JMXCommandLine -jmx "service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi" -user admin -pass admin startAppInstance ${userLogin}`;

    console.log(`▶️ Iniciando aplicação novamente...`);
    const output = await SSHManager.executeCommand(serverId, startCommand);

    console.log(`✅ Aplicação Wowza reiniciada com sucesso para ${userLogin}`);
    console.log(`Output: ${output}`);

    res.json({
      success: true,
      message: `Aplicação reiniciada com sucesso para ${userLogin}`,
      output: output,
      user: userLogin
    });

  } catch (error) {
    console.error('❌ Erro ao reiniciar aplicação Wowza:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao reiniciar aplicação Wowza'
    });
  }
});

// GET /api/wowza-control/status - Verificar status da aplicação
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar informações do usuário
    const [userRows] = await db.execute(
      'SELECT usuario, email, codigo_servidor FROM streamings WHERE codigo_cliente = ? LIMIT 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const userData = userRows[0];
    const userLogin = userData.usuario || userData.email.split('@')[0] || `user_${userId}`;
    const serverId = userData.codigo_servidor || 1;

    // Comando para verificar status (lista todas as aplicações)
    const command = `cd /usr/local/WowzaMediaServer && export WOWZA_HOME=/usr/local/WowzaMediaServer && /usr/bin/java -cp "lib/*:bin" com.wowza.wms.jmx.JMXCommandLine -jmx "service:jmx:rmi://localhost:8084/jndi/rmi://localhost:8085/jmxrmi" -user admin -pass admin getAppInstances`;

    const output = await SSHManager.executeCommand(serverId, command);

    // Verificar se a aplicação do usuário está na lista
    const outputStr = typeof output === 'string' ? output : (output?.stdout || '');
    const isRunning = outputStr.includes(userLogin);

    res.json({
      success: true,
      running: isRunning,
      user: userLogin,
      message: isRunning ? 'Aplicação está rodando' : 'Aplicação está parada'
    });

  } catch (error) {
    console.error('❌ Erro ao verificar status da aplicação:', error);
    res.json({
      success: false,
      running: false,
      error: error.message || 'Erro ao verificar status'
    });
  }
});

module.exports = router;
