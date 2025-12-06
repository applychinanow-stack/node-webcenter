import Marketplace from "../models/marketplace.js"
import axios from "axios";
// ---------------------- CREATE MARKETPLACE ----------------------
export const createMarketplace = async (req, res) => {
  try {
    const { name, apiKey, status } = req.body;

    // Validate required fields
    if (!name || !apiKey) {
      return res.status(400).json({ error: "Name and API key are required." });
    }

    // Check if marketplace already exists
    const existing = await Marketplace.findOne({ name });
    if (existing) {
      return res.status(400).json({ error: "Marketplace with this name already exists." });
    }

    const newMarketplace = new Marketplace({
      name,
      apiKey,
      status: status || "Active",
      lastSync: new Date(),
    });

    const savedMarketplace = await newMarketplace.save();
    res.status(201).json({
      message: "Marketplace created successfully",
      marketplace: savedMarketplace,
    });
  } catch (error) {
    console.error("Error creating marketplace:", error.message);
    res.status(500).json({ error: "Server error creating marketplace" });
  }
};

// Optional: get all marketplaces
export const getAllMarketplaces = async (req, res) => {
  try {
    const marketplaces = await Marketplace.find().sort({ name: 1 });
    res.status(200).json({ count: marketplaces.length, marketplaces });
  } catch (error) {
    console.error("Error fetching marketplaces:", error.message);
    res.status(500).json({ error: "Server error fetching marketplaces" });
  }
};
export const updateMarketplace = async (req, res) => {
  try {
    const { id } = req.params;
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "apiKey is required",
      });
    }

    const marketplace = await Marketplace.findByIdAndUpdate(
      id,
      { apiKey },
      { new: true }
    );

    if (!marketplace) {
      return res.status(404).json({
        success: false,
        message: "Marketplace not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Marketplace API Key updated successfully",
      data: marketplace,
    });
  } catch (error) {
    console.error("Update Marketplace Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
export const testMarketplaceAPI = async (req, res) => {
const { name, apiKey } = req.body;

  try {
    let response;

    if (name === "GGChest") {
      response = await axios.get(
        "https://sellerapi.ggchest.com/v1/games",
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );
    }

    if (name === "GameBoost") {
      response = await axios.get(
        "https://api.gameboost.com/v2/me",
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: "API Key is valid",
      data: response.data,
    });

  } catch (error) {
    console.log("API Key Test Error:", error.response?.data || error.message);

    return res.status(400).json({
      success: false,
      message: "Invalid API Key",
      error: error.response?.data || error.message,
    });
  }
};



