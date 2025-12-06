import cron from "node-cron";
import { checkGgChestSales , checkGameBoostSales} from "../controllers/listingController.js"
export const startCronJobs = () => {
cron.schedule("*/2 * * * *", async () => {
    console.log("⏳ Checking GGChest sales...");
     await checkGameBoostSales();
    await checkGgChestSales();
  });
};