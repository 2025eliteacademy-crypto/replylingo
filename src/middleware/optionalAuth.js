import { getAuth } from "firebase-admin/auth";

// Like auth.js, but never blocks the request. Funnel events fire before a
// user has necessarily signed in (app_open, onboarding) — so this attaches
// req.user when a valid Firebase token is present and just proceeds
// anonymously otherwise, including when the token is present but invalid
// or expired. Analytics must never 401 a client.
const optionalAuth = async (req, res, next) => {
  req.user = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const idToken = authHeader.split("Bearer ")[1];
      req.user = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      req.user = null;
    }
  }

  next();
};

export default optionalAuth;
