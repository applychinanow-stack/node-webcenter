import Log from "../models/logSchema.js";
export const getAllLogs = async (req, res) => {
  try {
    const logs = await Log.find()
      .populate("listing", "title game price") // optional: include listing info
      .sort({ timestamp: -1 }); // latest logs first

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ success: false, error: "Server error fetching logs" });
  }
};



