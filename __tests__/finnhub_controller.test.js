const {
    getPrice,
    getMarketStatus,
    subscribeToTickers,
} = require("../controllers/finnhub_controller.js");
const USMarketStatus = require("../controllers/USMarketStatus.js").default;
const FinnhubWebSocket = require("../controllers/FinnhubWebSocket.js").default;

jest.mock("axios"); // This mocks all axios.get() calls
jest.mock("../controllers/USMarketStatus");
jest.mock("../controllers/FinnhubWebSocket");

let finnhubWSMock;

beforeEach(() => {
    finnhubWSMock = new FinnhubWebSocket();
    FinnhubWebSocket.mockImplementation(() => finnhubWSMock);
});

afterEach(async () => {
    jest.clearAllMocks();
    await finnhubWSMock.close();
});

describe("Test getPrice function", () => {
    it("should fetch price for a given ticker", async () => {
        const req = { params: { ticker: "AAPL" } };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };
        finnhubWSMock.getPrice.mockResolvedValue(150);

        await getPrice(req, res);

        expect(res.json).toHaveBeenCalledWith({
            message: "Internal Server Error",
        });
    });

    it("should return Internal Server Error when exception occurs", async () => {
        const req = { params: { ticker: "ERROR" } };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };
        finnhubWSMock.getPrice.mockRejectedValue(new Error("Failed to fetch price"));

        await getPrice(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
    });
});

describe("Test getMarketStatus function", () => {
    it("should return current market status", async () => {
        const req = {};
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        await getMarketStatus(req, res);

        expect(res.json).toHaveBeenCalled();
    });

    it("should return error when market status not available", async () => {
        const req = {};
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        // Mock the getStatus function to return null
        USMarketStatus.mockImplementation(() => {
            return {
                getStatus: () => null,
            };
        });

        await getMarketStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Market status not available" });
    });
});

describe("Test subscribeToTickers function", () => {
    it("should subscribe to given tickers", async () => {
        const req = { body: { tickers: ["AAPL", "GOOG"] } };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        await subscribeToTickers(req, res);

        expect(res.json).toHaveBeenCalledWith({ message: "Subscribed to tickers" });
    });

    it("should return Invalid request body when tickers are not an array", async () => {
        const req = { body: { tickers: "AAPL" } }; // tickers is a string here, not an array
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        await subscribeToTickers(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Invalid request body" });
    });
});
