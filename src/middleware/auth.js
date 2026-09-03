import { getAuth } from "firebase-admin/auth";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token missing.",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];

    const decodedToken = await getAuth().verifyIdToken(idToken);

    req.user = decodedToken;

    // Must be checked BEFORE the upsert below, and here specifically — this
    // middleware runs on every authenticated route, so it's the one place
    // guaranteed to see "no doc yet" on a user's very first request ever.
    // (getMe used to run this same check itself, but by the time it ran,
    // this middleware had already upserted the doc on the same request,
    // so its check always found the doc "existing" and isNewUser was
    // always false — see req.isNewUser usage in user.controller.js.)
    const existingUser = await User.findOne({ uid: decodedToken.uid }).select("_id").lean();
    req.isNewUser = !existingUser;

    // Create the user doc on first request, or just note their existence.
    // This runs on every request, but findOneAndUpdate with upsert is a
    // single cheap indexed query — negligible overhead.
    await User.findOneAndUpdate(
      { uid: decodedToken.uid },
      {
        $setOnInsert: {
          uid: decodedToken.uid,
          email: decodedToken.email || null,
          guest: decodedToken.firebase?.sign_in_provider === "anonymous",
        },
      },
      { upsert: true, new: true }
    );
    console.log("User authenticated:", req.user);
    next();
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

export default auth;