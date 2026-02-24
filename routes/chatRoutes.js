import express from "express";
import { askQuestion, getSessions, getHistory } from "../controllers/chatController.js";

const router = express.Router();

router.post("/query", askQuestion);

router.get("/sessions", getSessions);

router.get("/history/:sessionId", getHistory);

export default router;
