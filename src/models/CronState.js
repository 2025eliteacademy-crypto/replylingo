import mongoose from "mongoose";

// One document per named job (e.g. "reengagement"), tracking the last time
// it actually ran. Lets the trigger endpoint be pinged as often as an
// uptime monitor likes without sending duplicate notification batches —
// the endpoint itself decides whether it's actually time to run.
const cronStateSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  lastRunAt: {
    type: Date,
    default: null,
  },
});

export default mongoose.model("CronState", cronStateSchema);
