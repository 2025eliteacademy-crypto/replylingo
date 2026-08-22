import express from "express";
import auth from "../middleware/auth.js";
import { getMe, updateVoice, syncPremium, deleteAccount, savePushToken } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me", auth, getMe);
router.patch("/voice", auth, updateVoice);
router.post("/sync-premium", auth, syncPremium);
router.delete("/account", auth, deleteAccount);
router.post("/push-token", auth, savePushToken);

export default router;