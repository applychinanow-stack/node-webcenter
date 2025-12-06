import mongoose from "mongoose";

const LogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
  listing: {
    type:String,
    required: true,
  },
  marketplace: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true,
  },
});

const Log = mongoose.model("Log", LogSchema);

export default Log;
