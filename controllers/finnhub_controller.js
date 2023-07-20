import WebSocket from "ws";
import dotenv from "dotenv";
import axios from "axios";
import cron from "node-cron";
import { DateTime, Settings } from "luxon";

// Set default zone
Settings.defaultZoneName = "UTC";

// Get current date in UTC
const currentDate = DateTime.utc();

// Convert currentDate to New York time
const currentDateNY = currentDate.setZone("America/New_York");

dotenv.config();

// This object will act as a cache for the most recent price for each ticker
// This is a dictionary mapping tickers to prices
const prices = {};
let usMarketStatus = null;

//IIFE Function that runs once the code is initialized
(async function() {
    if (
        !usMarketStatus ||
        (usMarketStatus.local_open === null &&
            usMarketStatus.local_close === null &&
            usMarketStatus.notes !== null)
    ) {
        await updateUSMarketStatus();
        console.log("Initialized market status");
    }
})();

const ws = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`);

ws.on("open", async () => {
    console.log("Connection to Finnhub service successful");
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
            if (usMarketStatus.local_open) {
                const [hours, minutes] = usMarketStatus.local_open.split(":");
                const openDateTime = DateTime.fromObject(
                    {
                        day: currentDateNY.day,
                        month: currentDateNY.month,
                        year: currentDateNY.year,
                        hour: parseInt(hours),
                        minute: parseInt(minutes),
                    },
                    { zone: "America/New_York" }
                );
                usMarketStatus.local_open = Math.floor(openDateTime.toSeconds()); //UNIX
            }
            // Convert local_close to UNIX timestamp
            if (usMarketStatus.local_close) {
                const [hours, minutes] = usMarketStatus.local_close.split(":");
                const closeDateTime = DateTime.fromObject(
                    {
                        day: currentDateNY.day,
                        month: currentDateNY.month,
                        year: currentDateNY.year,
                        hour: parseInt(hours),
                        minute: parseInt(minutes),
                    },
                    { zone: "America/New_York" }
                );
                usMarketStatus.local_close = Math.floor(closeDateTime.toSeconds()); //UNIX
            }
            console.log("Updated US market status");
        } else {
            console.log("Could not find US market data");
        }
    } catch (error) {
        console.error("Failed to update US market status:", error);
    }
}

// Check if the current time is within the market open and close times
function isMarketOpen() {
    if (!usMarketStatus || !usMarketStatus.local_open || !usMarketStatus.local_close) {
        // If the open or close times are not available, assume the market is closed
        return false;
    }

    const currentTime = Math.floor(new Date().getTime() / 1000);
    const openTime = usMarketStatus.local_open;
    const closeTime = usMarketStatus.local_close;

    return currentTime >= openTime && currentTime <= closeTime;
}

//-----------------------------ENDPOINTS----------------------------------------------//

// Endpoint to get the current price for a ticker
async function getPrice(req, res) {
    try {
        const ticker = req.params.ticker;

        // If the ticker is not inside the cache, subscribe to it
        if (!prices[ticker]) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "subscribe", symbol: ticker }));
            } else {
                console.log("WebSocket is not open. Cannot subscribe to ticker:", ticker);
            }
        }

        let price = prices[ticker];

        // If the price is not available through WebSocket after 2 seconds, get it from the REST API
        if (!price) {
            const response = await axios.get(
                `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`
            );
            if (response.data && response.data.c) {
                price = response.data.c; // Current price
                prices[ticker] = price; // Save the price in the cache
            }
        }

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

// Market status endpoint
async function getMarketStatus(req, res) {
    if (!usMarketStatus) {
        return res.status(500).json({ message: "Market status not available" });
    }

    const currentStatus = isMarketOpen() ? "open" : "closed";

    return res.json({ ...usMarketStatus, current_status: currentStatus });
}

async function subscribeToTickers(req, res) {
    const tickers = req.body.tickers;

    if (!tickers || !Array.isArray(tickers)) {
        return res.status(400).json({ message: "Invalid request body" });
    }

    // Subscribe to each ticker
    tickers.forEach((ticker) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "subscribe", symbol: ticker }));
        } else {
            console.log("WebSocket is not open. Cannot subscribe to ticker:", ticker);
        }
    });

    return res.json({ message: "Subscribed to tickers" });
}

// Schedule the updateUSMarketStatus function to run at 6 AM Singapore time
cron.schedule("0 6 * * *", updateUSMarketStatus, {
    timezone: "Asia/Singapore",
});

export { getPrice, getMarketStatus, subscribeToTickers };
