import { getAuth } from "firebase-admin/auth";

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