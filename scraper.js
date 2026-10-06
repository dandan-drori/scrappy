import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_URL = process.env.YAD2_FILTER_URL || 'https://www.yad2.co.il/realestate/forsale';
const STATE_FILE = path.join(__dirname, 'state.json');

const CARD_SELECTOR = 'ul[data-testid="feed-list"] > li';

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID in environment variables.');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true }
    })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(`Telegram API Error: ${errData.description}`);
  }
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        count: data.count || 0,
        seenIds: new Set(data.seenIds || [])
      };
    } catch {
      return { count: 0, seenIds: new Set() };
    }
  }
  return { count: 0, seenIds: new Set() };
}

function saveState(count, seenIdsSet) {
  const data = {
    count,
    seenIds: Array.from(seenIdsSet),
    lastUpdated: new Date().toISOString()
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

async function runScraper() {
  console.log('Starting Yad2 count monitor...');
  const prevState = loadState();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  try {
    console.log(`Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('Waiting for feed list...');
    await page.waitForSelector('ul[data-testid="feed-list"]', { timeout: 35000 });

    console.log('Scrolling page to trigger lazy-loaded listings...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight > 8000) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });

    await new Promise(r => setTimeout(r, 2000));

    const rawListings = await page.evaluate((selector) => {
      const items = Array.from(document.querySelectorAll(selector));

      return items.map((el, index) => {
        const priceEl = 
          el.querySelector('[data-testid="price"]') || 
          el.querySelector('[data-testid="ad-card-price"] [data-testid="price"]') ||
          el.querySelector('[data-testid="ad-card-price"]');

        const titleEl = 
          el.querySelector('[data-nagish="content-section-title"]') || 
          el.querySelector('h2[data-nagish="content-section-title"]') ||
          el.querySelector('[data-testid="feed-item-title"]') ||
          el.querySelector('h2, h3, .title');

        const detailsEl = 
          el.querySelector('[data-testid="ad-card-details"]') ||
          el.querySelector('[data-testid="feed-item-subtitle"]') ||
          el.querySelector('.subtitle');

        const linkEl = 
          el.querySelector('a[data-nagish="feed-item-layout-link"]') ||
          el.querySelector('a[href*="/item/"]') ||
          el.querySelector('a[href*="/realestate/item/"]') ||
          el.querySelector('a');

        const price = priceEl?.innerText?.trim() || '';
        const title = titleEl?.innerText?.trim() || '';
        const details = detailsEl?.innerText?.trim() || '';
        const href = linkEl?.getAttribute('href') || '';

        const idMatch = href.match(/item\/([a-zA-Z0-9_-]+)/);
        const id = idMatch ? idMatch[1] : null;
        const link = href ? (href.startsWith('http') ? href : `https://www.yad2.co.il${href}`) : '';

        return { id, title: title || 'Real Estate Listing', price: price || 'Price on request', details, link, rawIndex: index };
      });
    }, CARD_SELECTOR);

    const uniqueListingsMap = new Map();

    for (const item of rawListings) {
      let uniqueKey = item.id;

      if (!uniqueKey) {
        if (item.title !== 'Real Estate Listing' || item.details !== '') {
          uniqueKey = `${item.title}_${item.details}_${item.price}`.replace(/\s+/g, '_');
        } else {
          uniqueKey = `item_index_${item.rawIndex}`;
        }
      }

      if (!uniqueListingsMap.has(uniqueKey)) {
        uniqueListingsMap.set(uniqueKey, { ...item, id: uniqueKey });
      }
    }

    const currentListings = Array.from(uniqueListingsMap.values());
    const currentCount = currentListings.length;
    const countDiff = currentCount - prevState.count;

    console.log(`Extracted ${rawListings.length} raw cards -> ${currentCount} unique listings.`);
    console.log(`Previous Count: ${prevState.count} | Current Count: ${currentCount} | Net Diff: ${countDiff}`);

    const brandNewItems = currentListings.filter(item => item.id && !prevState.seenIds.has(item.id));

    const updatedSeenIds = new Set(prevState.seenIds);
    currentListings.forEach(item => updatedSeenIds.add(item.id));

    if (countDiff > 0) {
      console.log(`Count increased by ${countDiff}. Sending Telegram notification...`);

      let message = `📈 *Yad2 Update: New Listings Found!*\n\n`;
      message += `• *Total Matches:* ${currentCount} (was ${prevState.count}, +${countDiff})\n`;
      message += `• 🔗 [View All Filtered Results](${TARGET_URL})\n\n`;

if (brandNewItems.length > 0) {
        message += `✨ *Newly Added Listing${brandNewItems.length > 1 ? 's' : ''}:*\n`;
        message += `------------------------------------\n`;

        brandNewItems.forEach((item, index) => {
          message += `\n${index + 1}. 🏠 *${item.title}*\n`;
          message += `   💰 *Price:* ${item.price}\n`;
          if (item.details) message += `   📍 *Details:* ${item.details}\n`;
          if (item.link) message += `   🔗 [Direct Link](${item.link})\n`;
        });
      }

      await sendTelegramMessage(message);
    } else {
      console.log('No net increase in listing count. Notification skipped.');
    }

    saveState(currentCount, updatedSeenIds);

  } catch (err) {
    console.error('Error during execution:', err.message);
    await sendTelegramMessage(`⚠️ *Yad2 Monitor Error:* ${err.message}`);
  } finally {
    await browser.close();
  }
}

runScraper();
