import express from "express";
import { getMarketStatus } from "../controllers/finnhub_controller.js";

const marketStatusRouter = express.Router();

marketStatusRouter.get("/", getMarketStatus);

export default marketStatusRouter;
