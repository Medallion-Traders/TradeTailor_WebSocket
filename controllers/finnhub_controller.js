import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

// This object will act as a cache for the most recent price for each ticker
// This is a dictionary mapping tickers to prices
const prices = {};

const ws = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`);

ws.on("open", function open() {
    // Subscribe to some tickers
    ws.send(JSON.stringify({ type: "subscribe", symbol: "AAPL" }));
    ws.send(JSON.stringify({ type: "subscribe", symbol: "MSFT" }));
});

ws.on("message", function incoming(data) {
    const trade = JSON.parse(data);

    if (trade.type === "trade") {
        // Update the price in the cache
        prices[trade.data[0].s] = trade.data[0].p;
    }
});

// Endpoint to get the current price for a ticker
app.get("/price/:ticker", (req, res) => {
    const ticker = req.params.ticker;

    // Return the price from the cache
    res.json({ ticker, price: prices[ticker] });
});

app.post("/subscribe", (req, res) => {
    const ticker = req.body.ticker;
    if (!tickerLastPrice[ticker]) {
        ws.send(JSON.stringify({ type: "subscribe", symbol: ticker }));
    }
    res.send(`Subscribed to ${ticker}`);
});
