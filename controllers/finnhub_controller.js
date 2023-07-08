import WebSocket from "ws";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

// This object will act as a cache for the most recent price for each ticker
// This is a dictionary mapping tickers to prices
const prices = {};

const ws = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`);

ws.on("open", async () => {
    try {
        // Inform backend server that websocket is switched on
        const backend_url = process.env.REACT_APP_SERVER_URL;
        await axios.get(`${backend_url}/webSocket`);
    } catch (error) {
        console.log(error);
    }
});

ws.on("message", (data) => {
    try {
        const trade = JSON.parse(data);

        if (trade.type === "trade") {
            // Update the price in the cache
            prices[trade.data[0].s] = trade.data[0].p;
        }
        //console.log(trade);
    } catch (error) {
        console.log(error);
    }
});

// Endpoint to get the current price for a ticker
async function getPrice(req, res) {
    try {
        const ticker = req.params.ticker;

        // If the ticker is not inside the cache, subscribe to it
        if (!prices[ticker]) {
            ws.send(JSON.stringify({ type: "subscribe", symbol: ticker }));
        }

        // Wait for 10 seconds for the price to be updated
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // If the ticker is not inside the cache, use AlphaVantage to pull the price
        if (!prices[ticker]) {
            await axios
                .get(
                    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
                )
                .then((response) => {
                    const current_price = response.data["Global Quote"]["05. price"];
                    prices[ticker] = current_price;
                })
                .catch((err) => console.log(err));
        }

        // Return the price from the cache
        res.json({ ticker, price: prices[ticker] });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export { getPrice };
