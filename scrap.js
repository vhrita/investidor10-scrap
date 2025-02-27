import puppeteer from 'puppeteer-core';
import { parseMonetaryValue } from './utils.js';
import PQueue from 'p-queue';

const BASE_URL = 'https://investidor10.com.br';
const PQUEUE_CONCURRENCY = Number(process.env.PQUEUE_CONCURRENCY) || 7;

const queue = new PQueue({
  concurrency: PQUEUE_CONCURRENCY,
  timeout: 60000,
  throwOnTimeout: true,
});

let browser;

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;

  const chromiumWsEndpoint = process.env.CHROMIUM_WS_ENDPOINT;
  const chromiumExecPath = process.env.CHROMIUM_EXEC_PATH || '/usr/bin/chromium-browser';

  try {
    if (chromiumWsEndpoint) {
      console.log(`🔗 Conectando ao Chromium via WebSocket: ${chromiumWsEndpoint}`);
      browser = await puppeteer.connect({ browserWSEndpoint: chromiumWsEndpoint });
    } else {
      console.log(`🚀 Iniciando Chromium localmente com caminho: ${chromiumExecPath}`);
      browser = await puppeteer.launch({
        executablePath: chromiumExecPath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-background-networking',
          '--no-zygote',
          '--window-size=1280,720',
        ],
      });
    }

    return browser;
  } catch (error) {
    console.error('❌ Falha ao iniciar ou conectar ao navegador:', error);
    throw error;
  }
}

async function setupPage(page) {
  await page.setViewport({ width: 1280, height: 720 });
  await page.setCacheEnabled(true);
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    const blockedResources = ['image', 'stylesheet', 'font', 'media'];
    if (blockedResources.includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  });
}

async function getFiiData(fiiCode) {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();
  await setupPage(page);

  console.time(`⏱️ FII ${fiiCode}`);

  try {
    const parseMonetaryValueStr = parseMonetaryValue.toString();
    await page.evaluateOnNewDocument((fnStr) => {
      window.parseMonetaryValue = eval(`(${fnStr})`);
    }, parseMonetaryValueStr);

    await page.goto(`${BASE_URL}/fiis/${fiiCode}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const isPageValid = await page.$('#table-indicators');
    if (!isPageValid) {
      throw new Error(`Nenhuma informação encontrada para o código ${fiiCode}`);
    }

    const fiiData = await page.evaluate(() => {
      const indicators = document.querySelector('#table-indicators');
      const allIndicators = [
        { name: 'Segmento', field: 'segment', finder: 'SEGMENTO' },
        { name: 'Tipo', field: 'type', finder: 'TIPO DE FUNDO' },
        { name: 'Valor Patrimonial', field: 'patrimonialValue', finder: 'VALOR PATRIMONIAL' },
      ];

      const fii = Array.from(indicators.querySelectorAll('div.cell')).reduce((acc, cell) => {
        const cellText = cell.textContent.trim().toLowerCase();
        const indicator = allIndicators.find((ind) => cellText.includes(ind.finder.toLowerCase()));

        if (indicator) {
          const divValue = cell.querySelector('div.value').textContent.trim();
          acc[indicator.field] =
            indicator.field === 'patrimonialValue'
              ? window.parseMonetaryValue(divValue)
              : divValue;
        }
        return acc;
      }, {});

      const cardsTickers = document.querySelectorAll('#cards-ticker > div');
      const allCards = [
        { name: 'P/VP', field: 'pvp', finder: 'P/VP' },
        { name: 'Variação', field: 'variation', finder: 'VARIAÇÃO' },
        { name: 'Cotação', field: 'price', finder: 'COTAÇÃO' },
        { name: 'Liquidez Diária', field: 'dailyLiquidity', finder: 'LIQUIDEZ' },
      ];

      Array.from(cardsTickers).forEach((card) => {
        const cardText = card.textContent.trim().toLowerCase();
        const cardIndicator = allCards.find((ind) =>
          cardText.includes(ind.finder.toLowerCase()),
        );
        if (cardIndicator) {
          const cardValue = card.querySelector('div._card-body span').textContent.trim();
          fii[cardIndicator.field] =
            cardIndicator.field === 'price' || cardIndicator.field === 'dailyLiquidity'
              ? window.parseMonetaryValue(cardValue)
              : parseFloat(cardValue.replace(',', '.').replace('%', '').trim());
        }
      });

      const dyHistory = document.querySelectorAll('div.dy-history span');

      fii.currentlyYield = parseFloat(dyHistory[0].textContent.replace(',', '.').replace('%', ''));
      fii.averageYield = parseFloat(dyHistory[1].textContent.replace(',', '.').replace('%', ''));

      return fii;
    });

    console.timeEnd(`⏱️ FII ${fiiCode}`);
    return fiiData;
  } catch (error) {
    console.error(`Erro ao processar o código ${fiiCode}:`, error.stack);
    return null;
  } finally {
    await page.close();
  }
}

async function getStockData(stockCode) {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();
  await setupPage(page);

  console.time(`⏱️ Stock ${stockCode}`);

  try {
    const parseMonetaryValueStr = parseMonetaryValue.toString();
    await page.evaluateOnNewDocument((fnStr) => {
      window.parseMonetaryValue = eval(`(${fnStr})`);
    }, parseMonetaryValueStr);

    await page.goto(`${BASE_URL}/stocks/${stockCode}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const exists = await page.$('#cards-ticker > div');
    if (!exists) throw new Error(`Nenhuma informação encontrada para o código ${stockCode}`);

    const stockData = await page.evaluate(() => {
      const cardsTickers = document.querySelectorAll('#cards-ticker > div');
      const allCards = [
        { name: 'P/L', field: 'pl', finder: 'P/L' },
        { name: 'P/VP', field: 'pvp', finder: 'P/VP' },
        { name: 'Variação', field: 'variation', finder: 'VARIAÇÃO' },
        { name: 'Cotação', field: 'price', finder: 'COTAÇÃO' },
        { name: 'Liquidez Diária', field: 'dailyLiquidity', finder: 'LIQUIDEZ' },
      ];

      const stock = {};
      Array.from(cardsTickers).forEach((card) => {
        const cardText = card.textContent.trim().toLowerCase();
        const cardIndicator = allCards.find((ind) =>
          cardText.includes(ind.finder.toLowerCase()),
        );
        if (cardIndicator) {
          const cardValue = card.querySelector('div._card-body span').textContent.trim();
          stock[cardIndicator.field] =
            cardIndicator.field === 'price' || cardIndicator.field === 'dailyLiquidity'
              ? window.parseMonetaryValue(cardValue)
              : parseFloat(cardValue.replace(',', '.').replace('%', '').trim());
        }
      });

      return stock;
    });
    console.timeEnd(`⏱️ Stock ${stockCode}`);
    return stockData;
  } catch (error) {
    console.error(`Erro ao processar o código ${stockCode}:`, error.stack);
    return null;
  } finally {
    await page.close();
  }
}

export async function processFii(fiiCode) {
  return queue.add(() => getFiiData(fiiCode));
}

export async function processStock(stockCode) {
  return queue.add(() => getStockData(stockCode));
}

export async function shutdown() {
  await queue.onIdle();
  if (browser && browser.isConnected()) await browser.close();
}
