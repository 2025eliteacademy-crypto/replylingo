import Usage from "../models/Usage.js";
import User from "../models/User.js";

const usageLimit = async (req, res, next) => {
  try {
    const uid = req.user.uid;

    // Find user
    const user = await User.findOne({ uid });

    // Premium users have unlimited translations
    if (user?.premium) {
      return next();
    }
    console.log("User is not premium, checking usage limit for uid:", uid);
    // Find usage record
    let usage = await Usage.findOne({ uid });

    console.log("Current usage record:", usage);

    // Create one if it doesn't exist
    if (!usage) {
      usage = await Usage.create({
  uid,
  usageCredits: 0,
  freeLimit: 3,
});
    }
    console.log("Usage record after check/create:", usage);
    // Free limit reached
    if (usage.usageCredits >= usage.freeLimit) {
      console.log("Free translation limit reached for uid (backoff):", uid);
      return res.status(403).json({
        success: false,
        premiumRequired: true,
        message: "Free translation limit reached.",
      });
    }

    // Save for controller
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