import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import socketRouter from "./routes/socketRouter.js";

dotenv.config();

const { REACT_APP_SERVER_URL, PORT } = process.env;

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
    app.use("/webSocket", socketRouter);
}

// The main function that starts the app
async function start() {
    const app = express();

    setupMiddleware(app);
    setupRoutes(app);

    const chosen_port = PORT || 3002;

    app.listen(chosen_port, () => console.log(`SERVER STARTED ON ${chosen_port}`));
}

start();
