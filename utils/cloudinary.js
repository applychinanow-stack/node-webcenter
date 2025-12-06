// backend/utils/cloudinaryUploader.js
import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";

// Cloudinary config
cloudinary.config({
  cloud_name: "dqysa78ab",
  api_key: "167132351628154",
  api_secret: "i0hZZVNJF-54MWHUQ6bqxRo6wGE"
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
