import axios from "axios";
import { DateTime, Settings } from "luxon";

// Set default zone
Settings.defaultZoneName = "UTC";

// Get current date in UTC
const currentDate = DateTime.utc();

// Convert currentDate to New York time
const currentDateNY = currentDate.setZone("America/New_York");

class USMarketStatus {
    constructor() {
        this.status = null;
        this.x = 0;
    }

    async updateStatus() {
        try {
            const response = await axios
                .get(
                    `https://www.alphavantage.co/query?function=MARKET_STATUS&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
                )
                .catch((err) => console.log(err));

            this.x += 1;
            console.log(`AlphaVantage was queried ${this.x} times`);
            console.log("Received response from Alpha Vantage:", response);
            const markets = response.data.markets;
            const usMarket = markets.find((market) => market.region === "United States");

            if (usMarket) {
                this.status = {
                    market_type: usMarket.market_type,
                    primary_exchanges: usMarket.primary_exchanges,
                    local_open: usMarket.local_open,
                    local_close: usMarket.local_close,
                    current_status: usMarket.current_status,
                    notes: usMarket.notes,
                };

                if (this.status.local_open) {
                    const [hours, minutes] = this.status.local_open.split(":");
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
                    this.status.local_open = Math.floor(openDateTime.toSeconds()); //UNIX
                }

                if (this.status.local_close) {
                    const [hours, minutes] = this.status.local_close.split(":");
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
                    this.status.local_close = Math.floor(closeDateTime.toSeconds()); //UNIX
                }
            } else {
                console.log("Could not find US market data");
            }
        } catch (error) {
            console.error("Failed to update US market status:", error);
        }
    }

    isOpen() {
        if (!this.status || !this.status.local_open || !this.status.local_close) {
            return false;
        }
        const currentTime = Math.floor(new Date().getTime() / 1000);
        const openTime = this.status.local_open;
        const closeTime = this.status.local_close;
        return currentTime >= openTime && currentTime <= closeTime;
    }

    // isOpen() {
    //     return true;
    // }

    getStatus() {
        return this.status;
    }
}

export default USMarketStatus;
