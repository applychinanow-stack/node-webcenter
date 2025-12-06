import express from "express";
import { getAllLogs } from "../controllers/logController.js";
const logrouter = express.Router();

// GET all logs
logrouter.get("/", getAllLogs);

export default logrouter;
