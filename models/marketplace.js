import mongoose from "mongoose";
const MarketplaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  apiKey: { type: String, required: true },
  status: { type: String, default: "Active" }, // Active / Inactive
  lastSync: { type: Date }, // Optional
});

const Marketplace= mongoose.model("Marketplace", MarketplaceSchema);
export default Marketplace;