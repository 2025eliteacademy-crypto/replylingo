import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import "./src/config/firebase.js";
import connectDB from "./src/config/mongo.js";

import userRoutes from "./src/routes/user.routes.js";
import translateRoutes from "./src/routes/translate.routes.js";


// Connect MongoDB
connectDB();

const app = express();

// ======================
// Middleware
// ======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// Routes
// ======================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 ReplyLingo Backend is running",
    version: "1.0.0",
  });
});

app.use("/api/user", userRoutes);
app.use("/api/translate", translateRoutes);

// ======================
// 404 Handler
// ======================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ======================
// Global Error Handler
// ======================
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ======================
// Start Server
// ======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("====================================");
  console.log("🚀 ReplyLingo Backend Started");
  console.log(`🌐 http://localhost:${PORT}`);
  console.log("====================================");
});