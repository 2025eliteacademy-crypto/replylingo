import express from "express";
import auth from "../middleware/auth.js";
import { submitPurchaseAbandonmentSurvey } from "../controllers/purchaseSurvey.controller.js";

const router = express.Router();

router.post("/purchase-abandonment", auth, submitPurchaseAbandonmentSurvey);

export default router;
