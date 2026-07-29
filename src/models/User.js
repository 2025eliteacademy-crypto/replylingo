import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
    },

    email: {
      type: String,
      default: null,
    },

    guest: {
      type: Boolean,
      default: false,
    },

    premium: {
      type: Boolean,
      default: false,
    },
    voiceId: {
  type: String,
  default: "male",
},
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);