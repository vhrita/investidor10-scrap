# Investidor10 Scraper API

A web scraper API that extracts financial data from [Investidor10](https://investidor10.com.br). The API currently retrieves data for **FIIs (Real Estate Investment Funds)** and **Stocks**.

## 🚨 Disclaimer

This project was developed for **personal use only**. **Commercial use of this code is not authorized**.

I am **not affiliated** with Investidor10, nor do I have any authorization to scrape data from their website. This project is solely a **personal challenge** and should not be considered an official or approved source of financial data.

## 📌 Features

- Scrapes **FIIs and Stocks** data from Investidor10.
- Implements **queue management** (`p-queue`) to control concurrency.
- Uses **Redis caching** for improved performance.
- Reduces network traffic by blocking unnecessary requests (e.g., images, media).
- Implements **automatic cache refresh** when enabled.

## 🛠️ Installation

### 1️⃣ Clone the Repository

```sh
git clone https://github.com/vhrita/investidor10-scrap
cd investidor10-scraper
```

### 2️⃣ Install Dependencies

```sh
npm install
```

### 3️⃣ Configure Environment Variables

Copy the `.env.example` file to `.env` and update the values as needed:

```sh
cp .env.example .env
```

#### Example `.env` Configuration:

```ini
API_TOKEN=your_secure_token
PORT=3000
CACHE_EXPIRATION=600
REFRESH_THRESHOLD=120
PQUEUE_CONCURRENCY=2
AUTO_REFRESH_CACHE=true
AUTO_REFRESH_DELAY=600000
```

### 4️⃣ Start the Server

Run the API server:

```sh
npm start
```

For development mode (with auto-restart on changes):

```sh
npm run dev
```

## 🔗 API Endpoints

### Get FII Data

**Endpoint:**  
```
GET /fii/:code
```

**Example Request:**  
```sh
curl -H "x-api-token: YOUR_API_TOKEN" http://localhost:3000/fii/KNRI11
```

**Response:**  
```json
{
  "segment": "Lajes Corporativas",
  "type": "Fundo de Tijolo",
  "patrimonialValue": 1200000000,
  "pvp": 0.95,
  "variation": 2.5,
  "price": 123.45,
  "dailyLiquidity": 150000,
  "currentDividendYield": 0.7,
  "averageDividendYield": 0.65
}
```

---

### Get Stock Data

**Endpoint:**  
```
GET /stock/:code
```

**Example Request:**  
```sh
curl -H "x-api-token: YOUR_API_TOKEN" http://localhost:3000/stock/PETR4
```

**Response:**  
```json
{
  "pl": 8.45,
  "pvp": 1.15,
  "variation": -0.3,
  "price": 34.78,
  "dailyLiquidity": 2500000
}
```

---

## 🔒 Authentication

The API requires an **API token** for authentication. Add the token in the request headers:

```
x-api-token: YOUR_API_TOKEN
```

Make sure to define your token in the `.env` file:

```
API_TOKEN=your_secure_token
```

## 🛑 Limitations

- **No authorization** from Investidor10 for data scraping.
- **Subject to breaking changes** if the website structure updates.
- **Not designed for large-scale production use**.

## 🛠️ Technologies Used

- **Node.js** (Express.js)
- **Puppeteer** (Headless browser automation)
- **Redis** (Caching system)
- **p-queue** (Queue management for efficient scraping)

## 📜 License

This project is licensed under the **ISC License**.

## 🤝 Contributing

This project was built as a **personal challenge** and is **not actively maintained** for external contributions.