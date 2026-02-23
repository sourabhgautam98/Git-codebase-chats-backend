const express = require("express");
const router = express.Router();
const { askQuestion, getSessions, getHistory } = require("../controllers/chatController");

// POST /api/chat/query — Ask a question about an ingested repo
router.post("/query", askQuestion);

// GET /api/chat/sessions — List all chat sessions
router.get("/sessions", getSessions);

// GET /api/chat/history/:sessionId — Get chat history for a session
router.get("/history/:sessionId", getHistory);

module.exports = router;
