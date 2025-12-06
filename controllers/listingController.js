import Listing from "../models/listSchema.js";
import Log from "../models/logSchema.js";
import Marketplace from "../models/marketplace.js";
import { cloudinaryUploader } from "../utils/cloudinary.js";
import axios from "axios";



// Marketplace API call helper
const marketplaceApiCall = async (market, method, offerId = null, data = {}) => {
  let url, headers;
  let API_KEY = market.apiKey;

  if (market.name === "GameBoost") {
    url = offerId
      ? `https://api.gameboost.com/v2/account-offers/${offerId}`
      : "https://api.gameboost.com/v2/account-offers";

    headers = { Authorization: `Bearer ${market.apiKey}` };
  }

  else if (market.name === "GGChest") {
    url = offerId
      ? `https://sellerapi.ggchest.com/v1/offers/accounts/${offerId}`
      : "https://sellerapi.ggchest.com/v1/offers/accounts";

    headers = {
      "X-Api-Key": market.apiKey,
      "Content-Type": "application/json",
    };
  }

  console.log(`[${market.name}] Payload:`, JSON.stringify(data, null, 2));

  return axios({ method, url, data, headers });
};



export const createListing = async (req, res) => {
  try {
    const { title, game, description, login, password, price } = req.body;
    const files = req.files; // array

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "Images are required" });
    }

    // Upload each file to Cloudinary
    const imageUrls = [];

    for (const file of files) {
      const result = await cloudinaryUploader(file.path);
      if (result && result.secure_url) {
        imageUrls.push(result.secure_url);
      }
    }

    // For debugging:
    console.log("Uploaded Images:", imageUrls);


    if (!title || !game || !price)
      return res.status(400).json({ error: "Title, game, and price are required." });

    const marketplaces = await Marketplace.find({ status: "Active" });
    const platforms = [];

    for (let market of marketplaces) {
      try {
        let data;

        // ---------------- GAMEBOOST FLOW ----------------
        if (market.name === "GameBoost") {
          const API_KEY = market.apiKey;

          // 1️⃣ Get all games
          const gamesResp = await axios.get("https://api.gameboost.com/v2/games", {
            headers: { Authorization: `Bearer ${API_KEY}` },
          });

          const gameObj = gamesResp.data.data.find(
            g => g.name.toLowerCase() === game.toLowerCase()
          );
          if (!gameObj) throw new Error("Game not found on GameBoost");

          // 2️⃣ Get template for this game
          const templateResp = await axios.get(
            `https://api.gameboost.com/v2/account-offers/templates/${gameObj.slug}`,
            { headers: { Authorization: `Bearer ${API_KEY}` } }
          );

          const template = templateResp.data.template;
          const accountData = template.account_data;

          // 3️⃣ Build account_data payload with actual values
          const account_payload = {
            server: accountData.server?.values?.[0] || "North America",
            current_tier: accountData.current_tier?.values?.[0] || "Unranked",
            current_division: accountData.current_division?.values?.[0] || 1,
            peak_tier: accountData.peak_tier?.values?.[0] || "Unranked",
            peak_division: accountData.peak_division?.values?.[0] || 1,
            platforms: accountData['platforms.*']?.values?.length
              ? [accountData['platforms.*'].values[0]]
              : ["PC"],
            level: accountData.level ?? 1,
          };

          // 4️⃣ Build final payload
          data = {
            title,
            game_id: gameObj.id,
            price: Number(price),
            description,
            login,
            password,
            image_urls: imageUrls.length ? imageUrls : [
              "https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885_1280.jpg"
            ],
            is_manual: false,
            account_data: account_payload
          };

          console.log("[GameBoost] Payload:", JSON.stringify(data, null, 2));
        }

        // ---------------- GGCHEST FLOW (unchanged) ----------------
        if (market.name === "GGChest") {
          const API_KEY = market.apiKey;

          const gamesResp = await axios.get("https://sellerapi.ggchest.com/v1/games", {
            headers: { "X-Api-Key": API_KEY }
          });

          const gameObj = gamesResp.data.find(
            g => g.name.toLowerCase() === game.toLowerCase()
          );

          if (!gameObj) continue;

          const game_id = gameObj.id;

          const attributesResp = await axios.get(
            `https://sellerapi.ggchest.com/v1/games/${game_id}/accounts/attributes`,
            { headers: { "X-Api-Key": API_KEY } }
          );

          const attributes = attributesResp.data.map(attr => ({
            id: attr.id,
            option_id: attr.options?.[0]?.id || null
          }));

          data = {
            game_id,
            title,
            description,
            price,
            delivery_method: "auto",
            delivery_time: "1d",
            qty_total: 1,
            qty_min: 1,
            attributes,
            accounts: [{ login, password }]
          };
        }

        // ---------------- SEND TO MARKETPLACE ----------------
        const resp = await marketplaceApiCall(market, "post", null, data);
        console.log("responce", resp);
        if (market.name === "GameBoost") {
          try {
            await axios.post(
              `https://api.gameboost.com/v2/account-offers/${resp.data.data.id}/list`,
              {},
              { headers: { Authorization: `Bearer ${market.apiKey}` } }
            );
            console.log("GameBoost: Offer listed successfully");
          } catch (listErr) {
            console.error("GameBoost listing failed:", listErr.response?.data || listErr);
          }
        }

        platforms.push({
          marketplace: market.name,
          price,
          status: "Active",
          offerId: market.name == "GameBoost" ? resp.data.data.id : resp.data.id,
          lastSynced: new Date(),
        });
        await Log.create({
          timestamp: new Date(),
          listing: game, // <-- use game name instead of listing _id
          marketplace: market.name,
          action: "Created",
          message: `Listing "${title}" for game "${game}" created successfully on ${market.name}`,
        });

      } catch (err) {
        console.error(`Error for marketplace ${market.name}:`, err.response?.data || err.message);
        await Log.create({
          timestamp: new Date(),
          listing: game,
          marketplace: market.name,
          action: "Failed",
          message: `Failed to create listing "${title}" for game "${game}" on ${market.name}: ${err.message}`,
        });
        continue;
      }
    }

    // Save listing in DB
    const newListing = new Listing({
      title,
      game,
      description,
      login,
      password,
      price,
      status: "Active",
      platforms,
    });

    const savedListing = await newListing.save();

    res.status(201).json({
      message: "Listing created on all marketplaces",
      listing: savedListing,
    });

  } catch (error) {
    console.error(error.response?.data || error.message || error);
    res.status(500).json({ error: "Server error creating listing" });
  }
};

export const getAllListing = async (req, res) => {
  try {
    const list = await Listing.find({}).sort({ createdAt: -1 });;

    return res.status(200).json({
      success: true,
      count: list.length,
      data: list,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ---------------------- UPDATE LISTING ----------------------
export const updateListing = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { title, game, description, login, password, price, status = "Active" } = req.body;


    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    // Upload new images if provided
    let imageUrls = listing.imageUrls || [];

    const marketplaces = await Marketplace.find({ status: "Active" });

    for (let market of marketplaces) {
      const platform = listing.platforms.find(p => p.marketplace === market.name);
      if (!platform) continue;

      try {
        if (market.name === "GameBoost") {
          const API_KEY = market.apiKey;

          // 1️⃣ Get all games
          const gamesResp = await axios.get("https://api.gameboost.com/v2/games", {
            headers: { Authorization: `Bearer ${API_KEY}` },
          });

          const gameObj = gamesResp.data.data.find(
            g => g.name.toLowerCase() === game.toLowerCase()
          );
          if (!gameObj) throw new Error("Game not found on GameBoost");

          // 2️⃣ Get template for this game
          const templateResp = await axios.get(
            `https://api.gameboost.com/v2/account-offers/templates/${gameObj.slug}`,
            { headers: { Authorization: `Bearer ${API_KEY}` } }
          );

          const template = templateResp.data.template;
          const accountData = template.account_data;

          // 3️⃣ Build account_data payload with actual values
          const account_payload = {
            server: accountData.server?.values?.[0] || "North America",
            current_tier: accountData.current_tier?.values?.[0] || "Unranked",
            current_division: accountData.current_division?.values?.[0] || 1,
            peak_tier: accountData.peak_tier?.values?.[0] || "Unranked",
            peak_division: accountData.peak_division?.values?.[0] || 1,
            platforms: accountData['platforms.*']?.values?.length
              ? [accountData['platforms.*'].values[0]]
              : ["PC"],
            level: accountData.level ?? 1,
          };

          // 4️⃣ Build GameBoost update payload
          const data = {
            title: title ?? listing.title,
            game_id: gameObj.id,
            price: Number(price),
            description: description ?? listing.description,
            login: login ?? listing.login,
            password: password ?? listing.password,
            image_urls: listing.imageUrls,
            is_manual: false,
            account_data: account_payload,
          };

          // 5️⃣ Send PUT update
          const response = await marketplaceApiCall(market, "patch", platform.offerId, data);

          platform.price = Number(price);
          platform.status = status;
          platform.lastSynced = new Date();

          await Log.create({
            timestamp: new Date(),
            listing: listing._id,
            marketplace: "GameBoost",
            action: "Updated",
            message: `Listing updated successfully on GameBoost`,
          });
        }
        if (market.name === "GGChest") {
          try {
            const API_KEY = market.apiKey;

            // Fetch existing offer details
            const existing = await axios.get(
              `https://sellerapi.ggchest.com/v1/offers/${platform.offerId}`,
              { headers: { "X-Api-Key": API_KEY } }
            );

            const currentDeliveryTime = existing.data.delivery_time;
            const currentDeliveryMethod = existing.data.delivery_method;

            // 1️⃣ Get game_id
            const gamesResp = await axios.get(
              "https://sellerapi.ggchest.com/v1/games",
              { headers: { "X-Api-Key": API_KEY } }
            );

            const gameObj = gamesResp.data.find(
              g => g.name.toLowerCase() === (game ?? listing.game).toLowerCase()
            );
            if (!gameObj) throw new Error("Game not found on GGChest");
            const game_id = gameObj.id;

            // 2️⃣ Get attributes
            const attributesResp = await axios.get(
              `https://sellerapi.ggchest.com/v1/games/${game_id}/accounts/attributes`,
              { headers: { "X-Api-Key": API_KEY } }
            );

            const attributes = attributesResp.data.map(attr => ({
              id: attr.id,
              option_id: attr.options?.[0]?.id ?? null
            }));

            // 3️⃣ Delivery time logic
            const newDeliveryTime =
              currentDeliveryMethod === "auto" ? null : currentDeliveryTime;

            // 4️⃣ Build update payload
            const data = {
              title: title ?? listing.title,
              description: description ?? listing.description,
              price: price.toString(),
              qty_total: 1,
              qty_min: 1,
              delivery_time: null, // ✔ correct delivery logic
              attributes,
              accounts: [
                {
                  id: null,
                  login: login,
                  password: password
                }
              ]
            };

            // 5️⃣ Update on GGChest
            await marketplaceApiCall(
              market,
              "put",
              platform.offerId,
              data
            );

            // 6️⃣ Update platform fields in DB
            platform.price = Number(price);
            platform.status = status;
            platform.lastSynced = new Date();

            // 7️⃣ Save Log
            await Log.create({
              timestamp: new Date(),
              listing: listing._id,
              marketplace: "GGChest",
              action: "Updated",
              message: `Listing updated successfully on GGChest )`,
            });

          } catch (error) {
            console.error("Error updating GGChest:", error.response?.data ?? error.message);
          }
        }
      } catch (err) {
        console.error(`Error updating ${market.name}:`, err.response?.data || err.message);
        await Log.create({
          timestamp: new Date(),
          listing: listing._id,
          marketplace: market.name,
          action: "Failed",
          message: `Failed to update listing "${listing.title}" on ${market.name}: ${err.message}`,
        });
      }
    }

    // Update listing fields in DB
    listing.title = title ?? listing.title;
    listing.game = game ?? listing.game;
    listing.description = description ?? listing.description;
    listing.login = login ?? listing.login;
    listing.password = password ?? listing.password;
    listing.price = price ?? listing.price;
    listing.status = status ?? listing.status;
    listing.imageUrls = imageUrls;
    listing.updatedAt = new Date();

    const updatedListing = await listing.save();

    res.status(200).json({
      message: "Listing updated successfully on GGChest",
      listing: updatedListing,
    });

  } catch (error) {
    console.error(error.response?.data || error.message || error);
    res.status(500).json({ error: "Server error updating listing" });
  }
};




// ---------------------- DELETE LISTING ----------------------


export const deleteListing = async (req, res) => {
  try {
    const { listingId } = req.params;

    if (!listingId) {
      return res.status(400).json({ message: "listingId is required" });
    }

    // 1️⃣ Fetch listing
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    console.log("Deleting listing:", listingId);

    // ────────────────────────────────────────────
    // 🟦 DELETE FROM GGChest
    // ────────────────────────────────────────────
    const ggPlatform = listing.platforms.find(
      (p) => p.marketplace.toLowerCase() === "ggchest"
    );

    if (ggPlatform?.offerId) {
      try {
        const ggInfo = await Marketplace.findOne({ name: "GGChest" });

        if (ggInfo?.apiKey) {
          const ggUrl = `https://sellerapi.ggchest.com/v1/offers/${ggPlatform.offerId}`;
          console.log("GGChest Delete:", ggUrl);

          await axios.delete(ggUrl, {
            headers: { "X-Api-Key": ggInfo.apiKey },
          });
        }
      } catch (err) {
        console.error("❌ GGChest delete error:", err.response?.data || err.message);
      }
    } else {
      console.log("⚠ No GGChest offerId — skipping GGChest delete.");
    }

    // ────────────────────────────────────────────
    // 🟩 DELETE FROM GAMEBOOST
    // ────────────────────────────────────────────
    const gbPlatform = listing.platforms.find(
      (p) => p.marketplace.toLowerCase() === "gameboost"
    );

    if (gbPlatform?.offerId) {
      try {
        const gbInfo = await Marketplace.findOne({ name: "GameBoost" });

        if (gbInfo?.apiKey) {
          const gbUrl = `https://api.gameboost.com/v2/account-offers/${gbPlatform.offerId}`;
          console.log("GameBoost Delete:", gbUrl);

          await axios.delete(gbUrl, {
            headers: {
              Authorization: `Bearer ${gbInfo.apiKey}`,
            },
          });
        }
      } catch (err) {
        console.error("❌ GameBoost delete error:", err.response?.data || err.message);
      }
    } else {
      console.log("⚠ No GameBoost offerId — skipping GameBoost delete.");
    }

    // ────────────────────────────────────────────
    // 🗑 DELETE FROM MONGODB
    // ────────────────────────────────────────────
    await Listing.findByIdAndDelete(listingId);

    return res.json({
      success: true,
      message: "Listing deleted from marketplaces (if available) and MongoDB",
    });

  } catch (error) {
    console.error("Delete Error:", error.response?.data || error.message);
    return res.status(500).json({
      message: "Failed to delete listing",
      error: error.response?.data || error.message,
    });
  }
};

// CHECK SOLD LISTINGS FROM GGChest
export const checkGgChestSales = async () => {
  try {
    const ggInfo = await Marketplace.findOne({ name: "GGChest" });
    if (!ggInfo) return;

    const API_KEY = ggInfo.apiKey;

    // fetch all listings
    const listings = await Listing.find({ status: "Active" });

    for (const listing of listings) {
      const platform = listing.platforms.find(
        (p) => p.marketplace === "GGChest"
      );

      if (!platform?.offerId) continue;

      // fetch offer details
      const url = `https://sellerapi.ggchest.com/v1/offers/${platform.offerId}`;
      console.log("urls are ", url);

      const resp = await axios.get(url, {
        headers: { "X-Api-Key": API_KEY }
      });
      console.log("resp are ", resp.data);
      const offer = resp.data;

      // SOLD?
      if (offer.qty_total === 0 || offer.status === "Sold" || offer.status === "DELETED") {
        console.log("🔥 SOLD on GGChest:", listing._id);

        // delete listing everywhere
        await deleteListingInternal(listing._id);

        await Log.create({
          timestamp: new Date(),
          listing: listing._id,
          marketplace: "GGChest",
          action: "Sold",
          message: `Listing sold on GGChest and removed from system`,
        });
      }
    }

  } catch (err) {
    console.error("GGChest Sale Check Error:", err.message);
  }
};

export const checkGameBoostSales = async () => {
  try {
    const gbInfo = await Marketplace.findOne({ name: "GameBoost" });
    if (!gbInfo) {
      console.log("❌ GameBoost marketplace not found");
      return;
    }

    const API_KEY = gbInfo.apiKey;

    // Fetch all active listings
    const listings = await Listing.find({ status: "Active" });


    for (const listing of listings) {
      const platform = listing.platforms.find(
        (p) => p.marketplace === "GameBoost"
      );
      if (!platform?.offerId) continue;
      console.log("platform offer id is", platform.offerId);

      
      const ordersResp = await axios.get(
        `https://api.gameboost.com/v2/account-offers/${platform.offerId}`,
        {
          headers: { Authorization: `Bearer ${API_KEY}` }
        }
      );


      console.log("📦 GameBoost Orders:", ordersResp.data.data.status);
      const order = ordersResp.data.data;

      if (order.status !== "listed") {
        console.log("🔥 SOLD on GameBoost:", listing._id);

        // 2️⃣ delete from both marketplaces + DB
        await deleteListingInternal(listing._id);

        // 3️⃣ Save log
        await Log.create({
          timestamp: new Date(),
          listing: listing._id,
          marketplace: "GameBoost",
          action: "Sold",
          message: `Listing SOLD on GameBoost #ORDER ${soldOrder.id} and removed from system`,
        });
      }
    }
  } catch (err) {
    console.error("❌ GameBoost Sale Check Error:", err.response?.data || err.message);
  }
};


export const deleteListingInternal = async (listingId) => {
  const listing = await Listing.findById(listingId);
  if (!listing) return;

  // Delete GGChest
  const ggPlatform = listing.platforms.find(p => p.marketplace.toLowerCase() === "ggchest");
  if (ggPlatform?.offerId) {
    const ggInfo = await Marketplace.findOne({ name: "GGChest" });
    if (ggInfo?.apiKey) {
      console.log("platformss", ggPlatform);
      let res = await axios.delete(`https://sellerapi.ggchest.com/v1/offers/${ggPlatform.offerId}`, {
        headers: { "X-Api-Key": ggInfo.apiKey },
      });
      console.log("res are ", res.data);
    }
  }

  // Delete GameBoost
  // const gbPlatform = listing.platforms.find(p => p.marketplace.toLowerCase() === "gameboost");
  // if (gbPlatform?.offerId) {
  //   const gbInfo = await Marketplace.findOne({ name: "GameBoost" });
  //   if (gbInfo?.apiKey) {
  //     await axios.delete(`https://api.gameboost.com/v2/account-offers/${gbPlatform.offerId}`, {
  //       headers: { Authorization: `Bearer ${gbInfo.apiKey}` },
  //     });
  //   }
  // }

  listing.status = "Sold";
  listing.soldPlatform = platformName;

  // Update the specific platform inside array
  listing.platforms = listing.platforms.map(p => {
    if (p.marketplace.toLowerCase() === platformName.toLowerCase()) {
      return {
        ...p.toObject(),
        status: "Sold",
        lastSynced: new Date()
      };
    }
    return p;
  });

  await listing.save();
};
