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
const subscriptions = {};

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

// function waitForPrice(ticker, attempts = 1) {
//     return new Promise((resolve, reject) => {
//         let count = 0;
//         const intervalId = setInterval(() => {
//             if (prices[ticker]) {
//                 clearInterval(intervalId);
//                 resolve(prices[ticker]);
//             } else if (count > attempts) {
//                 clearInterval(intervalId);
//                 reject(new Error("Price update timed out"));
//             }
//             count++;
//         }, 2000);
//     });
// }

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

        //REPLACEMENT VERSION 1

        let price = prices[ticker];

        setTimeout(async () => {
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
            // Update the last access time every time you access a ticker
            subscriptions[ticker] = Date.now();

            // Return the price from the cache
            return res.json({
                ticker,
                price: prices[ticker],
            });
        }, 2000);

        //END OF VERSION 1
        //REPLACEMENT VERSION 2

        // let price;

        // // Make an attempt to retrieve the price
        // try {
        //     price = await waitForPrice(ticker);
        // } catch (error) {
        //     console.log("No WebSocket update for price, falling back to REST API");
        // }

        // // If the price is not available through WebSocket, get it from the REST API
        // if (!price) {
        //     const response = await axios.get(
        //         `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`
        //     );
        //     if (response.data && response.data.c) {
        //         price = response.data.c; // Current price
        //         // Save the price in the cache
        //         prices[ticker] = price;
        //     }
        // }

        // // Update the last access time every time you access a ticker
        // subscriptions[ticker] = Date.now();

        // // Return the price from the cache
        // return res.json({
        //     ticker,
        //     price: prices[ticker],
        // });
        //END OF VERSION 2
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

// Market status endpoint
function getMarketStatus(req, res) {
    if (!usMarketStatus) {
        return res.status(500).json({ message: "Market status not available" });
    }

    const currentStatus = isMarketOpen() ? "open" : "closed";

    return res.json({ ...usMarketStatus, current_status: currentStatus });
}

// Schedule the updateUSMarketStatus function to run at 6 AM Singapore time
cron.schedule("0 6 * * *", updateUSMarketStatus, {
    timezone: "Asia/Singapore",
});

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
