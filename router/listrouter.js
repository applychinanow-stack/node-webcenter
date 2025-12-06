import express from "express";
import { createListing, updateListing, deleteListing, getAllListing, checkGgChestSales } from "../controllers/listingController.js";
import { upload } from "../middleware/multer.js";

const listrouter = express.Router();
listrouter.post("/",upload.array('image_urls',5),createListing);                        
listrouter.patch("/:listingId", updateListing);      // Update listing
listrouter.delete("/:listingId", deleteListing);   // Delete listing
listrouter.get("/all",getAllListing);              // get all listing
listrouter.get("/sync/ggchest/orders",checkGgChestSales);              // get all listing
export default listrouter;