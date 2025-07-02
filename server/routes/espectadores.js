import express from 'express';
import { supabase, supabaseAuthMiddleware } from '../supabaseClient.js';

const router = express.Router();

// GET /api/espectadores - Listar espectadores ativos
router.get('/', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodo = '24h' } = req.query;

    // Definir período de tempo
    let timeFilter = new Date();
    switch (periodo) {
      case '1h':
        timeFilter.setHours(timeFilter.getHours() - 1);
        break;
      case '24h':
        timeFilter.setHours(timeFilter.getHours() - 24);
        break;
      case '7d':
        timeFilter.setDate(timeFilter.getDate() - 7);
        break;
      case '30d':
        timeFilter.setDate(timeFilter.getDate() - 30);
        break;
      default:
        timeFilter.setHours(timeFilter.getHours() - 24);
    }

    const { data: espectadores, error } = await supabase
      .from('espectadores')
      .select('*')
      .eq('id_user', userId)
      .gte('created_at', timeFilter.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Agrupar dados para estatísticas
    const estatisticas = {
      total: espectadores.length,
      ativos: espectadores.filter(e => e.ativo).length,
      paises: {},
      cidades: {},
      dispositivos: {},
      navegadores: {},
      tempoMedio: 0,
      picos: []
    };

    // Processar dados dos espectadores
    espectadores.forEach(espectador => {
      // Países
      if (espectador.pais) {
        estatisticas.paises[espectador.pais] = (estatisticas.paises[espectador.pais] || 0) + 1;
      }

      // Cidades
      if (espectador.cidade) {
        estatisticas.cidades[espectador.cidade] = (estatisticas.cidades[espectador.cidade] || 0) + 1;
      }

      // Dispositivos
      if (espectador.dispositivo) {
        estatisticas.dispositivos[espectador.dispositivo] = (estatisticas.dispositivos[espectador.dispositivo] || 0) + 1;
      }

      // Navegadores
      if (espectador.navegador) {
        estatisticas.navegadores[espectador.navegador] = (estatisticas.navegadores[espectador.navegador] || 0) + 1;
      }
    });

    // Calcular tempo médio de visualização
    const temposVisualizacao = espectadores
      .filter(e => e.tempo_visualizacao)
      .map(e => e.tempo_visualizacao);
    
    if (temposVisualizacao.length > 0) {
      estatisticas.tempoMedio = Math.round(
        temposVisualizacao.reduce((a, b) => a + b, 0) / temposVisualizacao.length
      );
    }

    res.json({
      espectadores,
      estatisticas
    });
  } catch (err) {
    console.error('Erro ao buscar espectadores:', err);
    res.status(500).json({ error: 'Erro ao buscar espectadores', details: err.message });
  }
});

// GET /api/espectadores/mapa - Dados para o mapa
router.get('/mapa', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodo = '24h' } = req.query;

    let timeFilter = new Date();
    switch (periodo) {
      case '1h':
        timeFilter.setHours(timeFilter.getHours() - 1);
        break;
      case '24h':
        timeFilter.setHours(timeFilter.getHours() - 24);
        break;
      case '7d':
        timeFilter.setDate(timeFilter.getDate() - 7);
        break;
      case '30d':
        timeFilter.setDate(timeFilter.getDate() - 30);
        break;
      default:
        timeFilter.setHours(timeFilter.getHours() - 24);
    }

    const { data: espectadores, error } = await supabase
      .from('espectadores')
      .select('latitude, longitude, pais, cidade, ip_hash, ativo, created_at')
      .eq('id_user', userId)
      .gte('created_at', timeFilter.toISOString())
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) throw error;

    // Agrupar por localização para evitar sobreposição
    const localizacoes = {};
    
    espectadores.forEach(espectador => {
      const key = `${espectador.latitude},${espectador.longitude}`;
      if (!localizacoes[key]) {
        localizacoes[key] = {
          latitude: espectador.latitude,
          longitude: espectador.longitude,
          pais: espectador.pais,
          cidade: espectador.cidade,
          count: 0,
          ativos: 0,
          ips: new Set()
        };
      }
      
      localizacoes[key].count++;
      if (espectador.ativo) localizacoes[key].ativos++;
      localizacoes[key].ips.add(espectador.ip_hash);
    });

    // Converter para array
    const pontosMapa = Object.values(localizacoes).map(loc => ({
      ...loc,
      ips: loc.ips.size
    }));

    res.json(pontosMapa);
  } catch (err) {
    console.error('Erro ao buscar dados do mapa:', err);
    res.status(500).json({ error: 'Erro ao buscar dados do mapa', details: err.message });
  }
});

// GET /api/espectadores/tempo-real - Dados em tempo real
router.get('/tempo-real', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar espectadores ativos nos últimos 5 minutos
    const timeFilter = new Date();
    timeFilter.setMinutes(timeFilter.getMinutes() - 5);

    const { data: espectadoresAtivos, error } = await supabase
      .from('espectadores')
      .select('*')
      .eq('id_user', userId)
      .eq('ativo', true)
      .gte('ultima_atividade', timeFilter.toISOString());

    if (error) throw error;

    // Buscar dados da transmissão atual
    const { data: transmissao, error: transmissaoError } = await supabase
      .from('transmissions')
      .select('*')
      .eq('id_user', userId)
      .eq('status', 'ativa')
      .single();

    const dadosTempoReal = {
      espectadoresAtivos: espectadoresAtivos.length,
      transmissaoAtiva: !!transmissao,
      transmissao: transmissao || null,
      espectadores: espectadoresAtivos,
      timestamp: new Date().toISOString()
    };

    res.json(dadosTempoReal);
  } catch (err) {
    console.error('Erro ao buscar dados em tempo real:', err);
    res.status(500).json({ error: 'Erro ao buscar dados em tempo real', details: err.message });
  }
});

// POST /api/espectadores/registrar - Registrar novo espectador (para uso interno)
router.post('/registrar', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      ip_hash,
      user_agent,
      pais,
      cidade,
      latitude,
      longitude,
      dispositivo,
      navegador,
      resolucao,
      referrer
    } = req.body;

    // Verificar se já existe um registro ativo para este IP
    const { data: existente } = await supabase
      .from('espectadores')
      .select('id')
      .eq('id_user', userId)
      .eq('ip_hash', ip_hash)
      .eq('ativo', true)
      .single();

    if (existente) {
      // Atualizar última atividade
      const { error: updateError } = await supabase
        .from('espectadores')
        .update({ ultima_atividade: new Date().toISOString() })
        .eq('id', existente.id);

      if (updateError) throw updateError;

      res.json({ success: true, action: 'updated', id: existente.id });
    } else {
      // Criar novo registro
      const { data: novoEspectador, error } = await supabase
        .from('espectadores')
        .insert([{
          id_user: userId,
          ip_hash,
          user_agent,
          pais,
          cidade,
          latitude,
          longitude,
          dispositivo,
          navegador,
          resolucao,
          referrer,
          ativo: true,
          tempo_visualizacao: 0,
          ultima_atividade: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, action: 'created', espectador: novoEspectador });
    }
  } catch (err) {
    console.error('Erro ao registrar espectador:', err);
    res.status(500).json({ error: 'Erro ao registrar espectador', details: err.message });
  }
});

// PUT /api/espectadores/:id/desconectar - Marcar espectador como desconectado
router.put('/:id/desconectar', supabaseAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { tempo_visualizacao } = req.body;

    const { error } = await supabase
      .from('espectadores')
      .update({
        ativo: false,
        tempo_visualizacao: tempo_visualizacao || 0,
        desconectado_em: new Date().toISOString()
      })
      .eq('id', id)
      .eq('id_user', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao desconectar espectador:', err);
    res.status(500).json({ error: 'Erro ao desconectar espectador', details: err.message });
  }
});

// GET /api/espectadores/historico - Histórico de audiência
router.get('/historico', supabaseAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodo = '7d', intervalo = '1h' } = req.query;

    let timeFilter = new Date();
    switch (periodo) {
      case '24h':
        timeFilter.setHours(timeFilter.getHours() - 24);
        break;
      case '7d':
        timeFilter.setDate(timeFilter.getDate() - 7);
        break;
      case '30d':
        timeFilter.setDate(timeFilter.getDate() - 30);
        break;
      default:
        timeFilter.setDate(timeFilter.getDate() - 7);
    }

    const { data: espectadores, error } = await supabase
      .from('espectadores')
      .select('created_at, ativo, tempo_visualizacao')
      .eq('id_user', userId)
      .gte('created_at', timeFilter.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Agrupar dados por intervalo de tempo
    const intervalos = {};
    const intervalMinutos = intervalo === '1h' ? 60 : intervalo === '30m' ? 30 : 15;

    espectadores.forEach(espectador => {
      const data = new Date(espectador.created_at);
      const intervalKey = new Date(
        data.getFullYear(),
        data.getMonth(),
        data.getDate(),
        Math.floor(data.getHours() / (intervalMinutos / 60)) * (intervalMinutos / 60)
      ).toISOString();

      if (!intervalos[intervalKey]) {
        intervalos[intervalKey] = {
          timestamp: intervalKey,
          espectadores: 0,
          tempoMedio: 0,
          tempos: []
        };
      }

      intervalos[intervalKey].espectadores++;
      if (espectador.tempo_visualizacao) {
        intervalos[intervalKey].tempos.push(espectador.tempo_visualizacao);
      }
    });

    // Calcular tempo médio para cada intervalo
    const historico = Object.values(intervalos).map(intervalo => ({
      timestamp: intervalo.timestamp,
      espectadores: intervalo.espectadores,
      tempoMedio: intervalo.tempos.length > 0 
        ? Math.round(intervalo.tempos.reduce((a, b) => a + b, 0) / intervalo.tempos.length)
        : 0
    }));

    res.json(historico);
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico', details: err.message });
  }
});

export default router;