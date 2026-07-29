import express from "express";
import auth from "../middleware/auth.js";
import { getMe, updateVoice } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me", auth, getMe);
router.patch("/voice", auth, updateVoice);

export default router;