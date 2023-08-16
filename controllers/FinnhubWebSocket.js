// FinnhubWebSocket.js
import WebSocket from "ws";

class FinnhubWebSocket {
    constructor() {
        this.ws = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`);
        this.ws.on("open", this.handleOpen.bind(this));
        this.ws.on("message", this.handleMessage.bind(this));
        this.ws.on("error", this.handleError.bind(this));
        this.prices = {};
        this.x = 0;
    }

    handleOpen() {
        console.log("Connection to Finnhub service successful");
    }

    handleMessage(data) {
        try {
            const trade = JSON.parse(data);

            if (trade.type === "trade") {
                this.prices[trade.data[0].s] = trade.data[0].p;
                //console.log(trade.data);
            }
        } catch (error) {
            console.log(error);
        }
    }

    handleError(error) {
        console.log("WebSocket error: ", error);
    }

    close() {
        this.ws.close();
    }

    send(data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        } else {
            console.log("WebSocket is not open. Cannot send data:", data);
        }
    }

    isOpen() {
        return this.ws.readyState === WebSocket.OPEN;
    }

    getPrice(ticker) {
        return this.prices[ticker];
    }
}

export default FinnhubWebSocket;
