import e from "express";
import mongoose from "mongoose";

// Sub-schema for per-platform tracking
const PlatformSchema = new mongoose.Schema({
  marketplace: { type: String, required: true },
  price: { type: Number, required: true },
  offerId:{ type: String },
  status: { type: String, default: "Active" },
  lastSynced: { type: Date, default: Date.now }
});

// Main Listing schema
const ListingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  game: { type: String, required: true },
  description: { type: String },
  login: { type: String },
  password: { type: String },
  price: { type: Number, required: true },
  status: { type: String, default: "Active" },
  soldPlatform: { type: String },
  platforms: [PlatformSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Listing = mongoose.model("Listing", ListingSchema);
export default Listing;
