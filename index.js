import express from "express";
import dotenv from "dotenv";
import connectDB from "./db/db.js";
import listrouter from "./router/listrouter.js";
import marketRouter from "./router/marketrouter.js";
import cors from "cors"
import logrouter from "./router/logrouter.js";
import { startCronJobs } from "./utils/corn.js";


dotenv.config();
connectDB(); // connect to MongoDB

const app = express();

app.use(cors({
  origin: "http://client-webcenter.vercel.app",   // React app URL
  credentials: true
}));
app.use(express.json()); // to parse JSON requests
startCronJobs();
// Use listing routes
app.use("/api/listings", listrouter);
app.use("/api/marketplaces", marketRouter);
app.use("/api/log",logrouter);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
