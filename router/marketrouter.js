import express from "express";
import { createMarketplace, getAllMarketplaces, testMarketplaceAPI, updateMarketplace } from "../controllers/marketplaceController.js"

const marketRouter = express.Router();

marketRouter.post("/create", createMarketplace);
marketRouter.get("/", getAllMarketplaces);
marketRouter.post("/test",testMarketplaceAPI);
marketRouter.put("/:id",updateMarketplace)

export default marketRouter;