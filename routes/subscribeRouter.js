import express from "express";
import { subscribeToTickers } from "../controllers/finnhub_controller.js";

const subscription = express.Router();

subscription.get("/", subscribeToTickers);

export default subscription;
