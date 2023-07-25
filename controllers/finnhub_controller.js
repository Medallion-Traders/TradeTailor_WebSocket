import dotenv from "dotenv";
import axios from "axios";
import cron from "node-cron";
import USMarketStatus from "../controllers/USMarketStatus.js";
import FinnhubWebSocket from "./FinnhubWebSocket.js";

dotenv.config();

const marketStatus = new USMarketStatus();
const finnhubWS = new FinnhubWebSocket();

(async function() {
    if (
        !marketStatus.getStatus() ||
        (marketStatus.getStatus().local_open === null &&
            marketStatus.getStatus().local_close === null &&
            marketStatus.getStatus().notes !== null)
    ) {
        await marketStatus.updateStatus();
        console.log("Initialized market status");
    }
})();

async function getMarketStatus(req, res) {
    if (!marketStatus.getStatus()) {
        return res.status(500).json({ message: "Market status not available" });
    }

    const currentStatus = marketStatus.isOpen() ? "open" : "closed";

    return res.json({ ...marketStatus.getStatus(), current_status: currentStatus });
}

async function getPrice(req, res) {
    try {
        const ticker = req.params.ticker;

        // If the ticker is not inside the cache, subscribe to it
        if (!finnhubWS.getPrice(ticker)) {
            finnhubWS.send(JSON.stringify({ type: "subscribe", symbol: ticker }));
        }

        let price = finnhubWS.getPrice(ticker);

        // If the price is not available through WebSocket after 2 seconds, get it from the REST API
        if (!price) {
            const response = await axios.get(
                `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`
            );
            if (response.data && response.data.c) {
                price = response.data.c; // Current price
                finnhubWS.prices[ticker] = price; // Save the price in the cache
            }
        }

        const result = finnhubWS.getPrice(ticker);
        console.log(result);
        // Return the price from the cache
        return res.json({
            ticker,
            price: result,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

cron.schedule("0 6 * * *", () => marketStatus.updateStatus(), {
    timezone: "Asia/Singapore",
});

export { getPrice, getMarketStatus };
