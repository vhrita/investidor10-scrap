import express from 'express';
import { createClient } from 'redis';
import { processFii, processStock } from './scrap.js';

const app = express();

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  password: process.env.REDIS_PASSWORD || '',
  database: Number(process.env.REDIS_DB_SUFFIX) || 0,
});

redisClient.on('connect', () => console.log('Connected to Redis!'));
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().catch(console.error);

const API_TOKEN = process.env.API_TOKEN;

const authenticate = (req, res, next) => {
  const token = req.headers['x-api-token'];
  if (token !== API_TOKEN) {
    return res.status(403).json({ error: 'Acesso não autorizado.' });
  }
  next();
};
app.use(authenticate);

const CACHE_EXPIRATION = Number(process.env.CACHE_EXPIRATION) || 3600;
const REFRESH_THRESHOLD = Number(process.env.REFRESH_THRESHOLD) || 300;

app.get('/fii/:code', async (req, res) => {
  const code = req.params.code;
  const CACHE_KEY = `fii:${code.toLowerCase()}`;

  try {
    const cachedData = await redisClient.get(CACHE_KEY);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    console.log(`Dados não encontrados no cache para o código: ${code}. Fazendo scraping.`);
    const data = await processFii(code);

    if (!data) {
      return res.status(404).json({ error: 'FII não encontrado.' });
    }

    await redisClient.setEx(CACHE_KEY, CACHE_EXPIRATION, JSON.stringify(data));
    res.json(data);
  } catch (error) {
    console.error(`Erro ao buscar dados para o código ${code}:`, error);
    res.status(500).json({ error: 'Erro ao buscar dados.' });
  }
});

app.get('/stock/:code', async (req, res) => {
  const code = req.params.code;
  const CACHE_KEY = `stock:${code.toLowerCase()}`;

  try {
    const cachedData = await redisClient.get(CACHE_KEY);
    if (cachedData) {
      console.log(`Dados encontrados no cache para o código: ${code}`);
      return res.json(JSON.parse(cachedData));
    }

    console.log(`Dados não encontrados no cache para o código: ${code}. Fazendo scraping.`);
    const data = await processStock(code);

    if (!data) {
      return res.status(404).json({ error: 'Stock não encontrada.' });
    }

    await redisClient.setEx(CACHE_KEY, CACHE_EXPIRATION, JSON.stringify(data));
    res.json(data);
  } catch (error) {
    console.error(`Erro ao buscar dados para o código ${code}:`, error);
    res.status(500).json({ error: 'Erro ao buscar dados.' });
  }
});

const refreshCache = async () => {
  try {
    const keys = await redisClient.keys('*');
    console.log(`Verificando ${keys.length} chaves no cache.`);

    for (const key of keys) {
      const ttl = await redisClient.ttl(key);

      if (ttl < REFRESH_THRESHOLD) {
        console.log(`Atualizando cache para a chave: ${key}, TTL restante: ${ttl}s`);
        
        const [type, code] = key.split(':');

        let updatedData = null;
        if (type === 'fii') {
          updatedData = await processFii(code);
        } else if (type === 'stock') {
          updatedData = await processStock(code);
        }

        if (updatedData) {
          await redisClient.setEx(key, CACHE_EXPIRATION, JSON.stringify(updatedData));
          console.log(`Cache atualizado para ${key}`);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao atualizar o cache:', error);
  }
};

if(process.env.AUTO_REFRESH_CACHE === 'true') {
  setInterval(refreshCache, Number(process.env.AUTO_REFRESH_DELAY) || 600000);
}

app.listen(Number(process.env.PORT) || 3001, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT || 3001}`);
});
