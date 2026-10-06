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
