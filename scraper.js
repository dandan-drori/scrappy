require('dotenv').config();
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const TelegramBot = require('node-telegram-bot-api');

puppeteer.use(StealthPlugin());

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(token, { polling: false });

const TARGET_URL = process.env.YAD2_FILTER_URL;
const STATE_FILE = path.join(__dirname, 'state.json');

// Read previous execution state
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

// Save current execution state
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
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for the feed container
    const itemSelector = '[data-testid="feed-item"], .feed_item, .feeditem';
    await page.waitForSelector(itemSelector, { timeout: 25000 });

    // Extract items currently matching the filter
    // Target selector specifically for valid listing items from the DOM screenshot
    const ITEM_SELECTORS = [
      '[data-testid="platinum-item"]',
      '[data-testid="item-basic"]',
      '[data-testid="agency-item"]'
    ].join(',');

      // Inside your page.evaluate() call:
      const currentListings = await page.evaluate((selector) => {
      const elements = Array.from(document.querySelectorAll(selector));
    
      return elements.map(el => {
        // Standard inner selectors or fallback text extractions
        const titleEl = el.querySelector('[data-testid="feed-item-title"], h2, h3, .title');
        const priceEl = el.querySelector('[data-testid="feed-item-price"], .price');
        const subtitleEl = el.querySelector('[data-testid="feed-item-subtitle"], .subtitle, .description');
        const linkEl = el.querySelector('a[href*="/item/"]');
    
        const title = titleEl?.innerText?.trim() || 'No Title';
        const price = priceEl?.innerText?.trim() || 'No Price';
        const details = subtitleEl?.innerText?.trim() || '';
        const href = linkEl?.getAttribute('href') || '';
    
        // Extract unique listing ID from href or fallback to content hash
        const idMatch = href.match(/item\/([a-zA-Z0-9]+)/);
        const id = idMatch ? idMatch[1] : (title + price).replace(/\s+/g, '_');
        const link = href ? (href.startsWith('http') ? href : `https://www.yad2.co.il${href}`) : '';

        return { id, title, price, details, link };
      });
    }, ITEM_SELECTORS);	

    const currentCount = currentListings.length;
    const countDiff = currentCount - prevState.count;

    console.log(`Previous Count: ${prevState.count} | Current Count: ${currentCount} | Net Diff: ${countDiff}`);

    // Identify brand-new listings that weren't in the seenIds set
    const brandNewItems = currentListings.filter(item => item.id && !prevState.seenIds.has(item.id));

    // Update seen IDs set with all current items
    const updatedSeenIds = new Set(prevState.seenIds);
    currentListings.forEach(item => updatedSeenIds.add(item.id));

    // TRIGGER LOGIC: Notify ONLY if the match count has increased
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
          message += `   🔗 [Direct Link](${item.link})\n`;
        });
      }

      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    } else {
      console.log('No net increase in listing count. Notification skipped.');
    }

    // Save updated state for the next run
    saveState(currentCount, updatedSeenIds);

  } catch (err) {
    console.error('Error during execution:', err.message);
    await bot.sendMessage(chatId, `⚠️ *Yad2 Monitor Error:* ${err.message}`, { parse_mode: 'Markdown' });
  } finally {
    await browser.close();
  }
}

runScraper();
