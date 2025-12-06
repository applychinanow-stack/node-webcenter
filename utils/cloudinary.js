// backend/utils/cloudinaryUploader.js
import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

// File upload utility
export const cloudinaryUploader = async (filePath) => {
  try {
    // Upload to Cloudinary
    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
      secure: true
    });

    // Delete local file
    fs.unlinkSync(filePath); // 🔥 No need for callback here

    return response;
  } catch (error) {
    // Delete local file even on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.error("❌ Error in Cloudinary upload:", error.message);
    return null;
  }
};
