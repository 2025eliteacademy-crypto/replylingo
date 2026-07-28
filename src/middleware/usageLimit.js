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

    // Find usage record
    let usage = await Usage.findOne({ uid });

    // Create one if it doesn't exist
    if (!usage) {
      usage = await Usage.create({
        uid,
        translationsUsed: 0,
        freeLimit: 3,
      });
    }

    // Free limit reached
    if (usage.translationsUsed >= usage.freeLimit) {
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