import Usage from "../models/Usage.js";
import User from "../models/User.js";

const usageLimit = async (req, res, next) => {
  try {
    const uid = req.user.uid;

    // Find user
    const user = await User.findOne({ uid });

    const PREMIUM_DAILY_LIMIT = 100;

    let usage = await Usage.findOne({ uid });
    if (!usage) {
      usage = await Usage.create({ uid, usageCredits: 0, freeLimit: 3 });
    }

    // Daily reset — applies to both free and premium counters
    const now = new Date();
    const isNewDay = now.toDateString() !== new Date(usage.lastReset).toDateString();
    if (isNewDay) {
      usage.usageCredits = 0;
      usage.lastReset = now;
      await usage.save();
    }

    if (user?.premium) {
      // Silent abuse guard — never surfaced to the client as "premiumRequired"
      if (usage.usageCredits >= PREMIUM_DAILY_LIMIT) {
        console.log("Premium daily cap hit (silent) for uid:", uid);
        return res.status(429).json({
          success: false,
          message: "Please try again later.",
        });
      }
      req.usage = usage;
      req.isPremiumUnlimitedUI = true;
      return next();
    }

    console.log("User is not premium, checking usage limit for uid:", uid);

    if (usage.usageCredits >= usage.freeLimit) {
      console.log("Free translation limit reached for uid (backoff):", uid);
      return res.status(403).json({
        success: false,
        premiumRequired: true,
        message: "Free translation limit reached.",
      });
    }

    req.usage = usage;
    next();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Usage limit check failed.",
    });
  }
};

export default usageLimit;