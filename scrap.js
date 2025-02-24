import puppeteer from 'puppeteer-core';
import { parseMonetaryValue } from './utils.js';
import PQueue from 'p-queue';

const BASE_URL = 'https://investidor10.com.br';
const PUPPETEER_OPTIONS = {
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-zygote',
    '--disable-background-networking',
    '--window-size=1920,1080',
  ],
};

const queue = new PQueue({ concurrency: Number(process.env.PQUEUE_CONCURRENCY) || 7 });

const browser = await puppeteer.launch(PUPPETEER_OPTIONS);

async function getFiiData(fiiCode) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  });

  try {
    const parseMonetaryValueStr = parseMonetaryValue.toString();
    await page.evaluateOnNewDocument((fnStr) => {
      window.parseMonetaryValue = eval(`(${fnStr})`);
    }, parseMonetaryValueStr);

    await page.goto(`${BASE_URL}/fiis/${fiiCode}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.setViewport({ width: 1080, height: 1024 });

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

    return fiiData;
  } catch (error) {
    console.error(`Erro ao processar o código ${fiiCode}:`, error.stack);
    return null;
  } finally {
    await page.close();
  }
}

async function getStockData(stockCode) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  });

  try {
    const parseMonetaryValueStr = parseMonetaryValue.toString();
    await page.evaluateOnNewDocument((fnStr) => {
      window.parseMonetaryValue = eval(`(${fnStr})`);
    }, parseMonetaryValueStr);

    await page.goto(`${BASE_URL}/stocks/${stockCode}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await page.setViewport({ width: 1080, height: 1024 });

    const exists = await page.$('#cards-ticker > div');
    if (!exists) {
      throw new Error(`Nenhuma informação encontrada para o código ${stockCode}`);
    }

    return await page.evaluate(() => {
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
  await browser.close();
}
