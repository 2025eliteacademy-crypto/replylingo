import { initializeApp, cert, getApps } from "firebase-admin/app";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync("./firebase-service-account.json", "utf8")
);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });

  console.log("✅ Firebase Admin Initialized");
}