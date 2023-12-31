import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import socketRouter from "./routes/socketRouter.js";
import marketStatusRouter from "./routes/marketStatusRouter.js";

dotenv.config();

function setupMiddleware(app) {
    app.use(cors());
    app.use(express.json());
    app.use(helmet());
    app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
    app.use(morgan("common"));
    app.use(bodyParser.urlencoded({ extended: true }));
}

// This function sets up all the routes for the app
function setupRoutes(app) {
    app.get("/", (req, res) => {
        console.log(
            `${process.env.PORT || 3002} Port server is ready and established connection with ${
                process.env.REACT_APP_SERVER_URL
            }`
        );
        return res.status(200).send("Server pinged successfully!");
    });
    app.head("/", (req, res) => res.end());
    app.use("/webSocket", socketRouter);
    app.use("/getMarketStatus", marketStatusRouter);
}

// The main function that starts the app
async function start() {
    const app = express();

    setupMiddleware(app);
    setupRoutes(app);

    app.listen(process.env.PORT || 3002, () =>
        console.log(`SERVER STARTED ON ${process.env.PORT || 3002}`)
    );
}

start();

function printMemoryUsage() {
    const usage = process.memoryUsage();
    console.log(`Memory Usage:
    RSS ${Math.round((usage.rss / 1024 / 1024) * 100) / 100} MB
    Heap Total ${Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100} MB
    Heap Used ${Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100} MB
    External ${Math.round((usage.external / 1024 / 1024) * 100) / 100} MB`);
}

// Use the function
printMemoryUsage();
setInterval(() => {
    printMemoryUsage();
}, 10000); // Prints memory usage every 10 seconds
