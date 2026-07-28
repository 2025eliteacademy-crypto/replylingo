import express from "express";
import multer from "multer";

import auth from "../middleware/auth.js";
import usageLimit from "../middleware/usageLimit.js";
import { translateMessage } from "../controllers/translate.controller.js";

const router = express.Router();

// Store uploaded audio temporarily in uploads/
const upload = multer({
  storage: multer.memoryStorage(),
});

router.post(
  "/message",
  auth,
  usageLimit,
  upload.single("audio"),
  translateMessage
);

export default router;