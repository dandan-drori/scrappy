# Yad2 Listing & Price Alert Bot

A lightweight, automated scraper built with Node.js and Puppeteer to monitor real estate search results on **Yad2** (`yad2.co.il`). It tracks listing updates in real time and sends instant formatted alerts directly to a **Telegram** channel or chat whenever new listings appear.

---

## Features

- **Automated Monitoring:** Periodic headless browser execution using Puppeteer with Stealth plugin support to handle dynamic page rendering.
- **Lazy-Load Scrolling:** Simulates smooth page scrolling to trigger lazy-loaded images, prices, and listings.
- **State Tracking:** Saves previously seen listings to a local `state.json` file to calculate net count differences and prevent duplicate notifications.
- **Telegram Notifications:** Sends clean Markdown alerts containing the updated match count, direct search filter link, and itemized listing details (title, price, location/details, and direct URL).

---

## Prerequisites

Before setting up the project, make sure you have:

- **Node.js:** `v18.x` or higher
- **npm:** `v9.x` or higher
- **Telegram Bot Token & Chat ID:** Created via [@BotFather](https://t.me/BotFather)

---

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <repository-folder>

2. Install dependencies:
  ```bash
  npm i

## Configuration

1. Create a `.env` file in the root directory:
  ```bash
  touch .env

2. Add your configuration values to .env:
```text
# Yad2 search results URL (with all your desired filters applied)
YAD2_FILTER_URL=[https://www.yad2.co.il/realestate/rent/center-and-sharon?property=1&minRooms=4&maxRooms=4&minPrice=5000&maxPrice=8000&minFloor=1&priceOnly=1&parking=1&elevator=1](https://www.yad2.co.il/realestate/rent/center-and-sharon?property=1&minRooms=4&maxRooms=4&minPrice=5000&maxPrice=8000&minFloor=1&priceOnly=1&parking=1&elevator=1)

# Telegram Credentials
TELEGRAM_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyZ
TELEGRAM_CHAT_ID=-1001234567890

## Telegram Setup Guide
1. Create a Bot
Open Telegram and search for @BotFather.

Send /newbot and follow the instructions to choose a name and username for your bot.

Copy the HTTP API Token provided (e.g., 123456789:ABCdef...).

2. Get Your Chat ID
Add your bot to a Telegram group/channel or send it a direct message.

Send a message to the bot or group.

Fetch your Chat ID by visiting the following URL in your browser:
```text
[https://api.telegram.org/bot](https://api.telegram.org/bot)<YOUR_TELEGRAM_TOKEN>/getUpdate

## Usage

Run the Scraper Once
Execute the main script directly:

```bash
node scraper.js
