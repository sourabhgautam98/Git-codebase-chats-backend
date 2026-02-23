const express = require("express");
const router = express.Router();
const { ingestRepo } = require("../controllers/repoController");

// POST /api/repo/ingest — Clone, parse, embed, and store a repo
router.post("/ingest", ingestRepo);

module.exports = router;
