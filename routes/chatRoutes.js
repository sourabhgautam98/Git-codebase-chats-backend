const express = require("express");
const router = express.Router();
const { askQuestion, getSessions, getHistory } = require("../controllers/chatController");

router.post("/query", askQuestion);

router.get("/sessions", getSessions);

router.get("/history/:sessionId", getHistory);

module.exports = router;
