import mongoose from "mongoose";

const usageSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
    },

usageCredits: {
  type: Number,
  default: 0,
},

freeLimit: {
  type: Number,
  default: 3,
},

    lastReset: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Usage", usageSchema);