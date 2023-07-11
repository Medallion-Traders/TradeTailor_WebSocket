import WebSocket from "ws";
import dotenv from "dotenv";
import axios from "axios";
import cron from "node-cron";

dotenv.config();

// This object will act as a cache for the most recent price for each ticker
// This is a dictionary mapping tickers to prices
const prices = {};
let usMarketStatus = null;
const subscriptions = {};

const ws = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`);

ws.on("open", async () => {
    try {
        // Inform backend server that websocket is switched on
        const backend_url = process.env.REACT_APP_SERVER_URL;
        await axios.get(`${backend_url}/webSocket`);
    } catch (error) {
        console.log("Error connecting to backend server:", error);
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

ws.on("error", (error) => {
    console.log("WebSocket error: ", error);
});

function waitForPrice(ticker, attempts = 2) {
    return new Promise((resolve, reject) => {
        let count = 0;
        const intervalId = setInterval(() => {
            if (prices[ticker]) {
                clearInterval(intervalId);
                resolve(prices[ticker]);
            } else if (count > attempts) {
                clearInterval(intervalId);
                reject(new Error("Price update timed out"));
            }
            count++;
        }, 2000);
    });
}

// Endpoint to get the current price for a ticker
async function getPrice(req, res) {
    try {
        const ticker = req.params.ticker;

        if (!usMarketStatus) {
            await updateUSMarketStatus();
        }

        if (usMarketStatus.current_status == "closed") {
            return res.json({
                ticker,
                price: undefined,
            });
        }

        // If the ticker is not inside the cache, subscribe to it
        if (!prices[ticker] && !subscriptions[ticker]) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "subscribe", symbol: ticker }));
            } else {
                console.log("WebSocket is not open. Cannot subscribe to ticker:", ticker);
            }
            subscriptions[ticker] = Date.now();
        }

        // Make 2 attempts over the span of 4 seconds to retrieve the price
        try {
            const price = await waitForPrice(ticker);
            prices[ticker] = price;
        } catch (error) {
            console.log("Error waiting for price" + error);
        }

        // Update the last access time every time you access a ticker
        subscriptions[ticker] = Date.now();

        // Return the price from the cache
        return res.json({
            ticker,
            price: prices[ticker],
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// This function will update the US market open and close times
async function updateUSMarketStatus() {
    try {
        // Make a request to the Alpha Vantage API
        const response = await axios
            .get(
                `https://www.alphavantage.co/query?function=MARKET_STATUS&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
            )
            .catch((err) => console.log(err));

        // Extract the market information from the response
        const markets = response.data.markets;

        // Find the US market in the list of markets
        const usMarket = markets.find((market) => market.region === "United States");

        if (usMarket) {
            // Store the US market status in the cache
            usMarketStatus = {
                market_type: usMarket.market_type,
                primary_exchanges: usMarket.primary_exchanges,
                local_open: usMarket.local_open,
                local_close: usMarket.local_close,
                current_status: usMarket.current_status,
                notes: usMarket.notes,
            };
            console.log("Updated US market status");
        } else {
            console.log("Could not find US market data");
        }
    } catch (error) {
        console.error("Failed to update US market status:", error);
    }
}

async function getMarketStatus(req, res) {
    try {
        if (!usMarketStatus) {
            await updateUSMarketStatus();
        }
        return res.json(usMarketStatus);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// Schedule the updateUSMarketStatus function to run every hour
cron.schedule("0 * * * *", updateUSMarketStatus);

// Add this to periodically unsubscribe from inactive tickers
cron.schedule("0 * * * *", () => {
    const now = Date.now();
    for (const [ticker, lastAccess] of Object.entries(subscriptions)) {
        if (now - lastAccess > 3600000) {
            // 1 hour of inactivity
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "subscribe", symbol: ticker }));
            } else {
                console.log("WebSocket is not open. Cannot subscribe to ticker:", ticker);
            }
            delete subscriptions[ticker];
            delete prices[ticker];
        }
    }
});

export { getPrice, getMarketStatus };
