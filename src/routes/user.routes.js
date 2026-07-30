import express from "express";
import auth from "../middleware/auth.js";
import { getMe, updateVoice, syncPremium } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me", auth, getMe);
router.patch("/voice", auth, updateVoice);
router.post("/sync-premium", auth, syncPremium);

export default router;