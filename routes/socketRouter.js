import express from "express";
import { getPrice } from "../controllers/finnhub_controller.js";

const socketRouter = express.Router();

socketRouter.get("/price/:ticker", getPrice);

export default socketRouter;
