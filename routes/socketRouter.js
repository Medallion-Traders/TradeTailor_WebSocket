import express from "express";
import { getPrice } from "../controllers/finnhub_controller.js";

const socketRouter = express.Router();

socketRouter.post("/price/:ticker", getPrice);

export default socketRouter;
