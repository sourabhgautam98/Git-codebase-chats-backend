const express = require("express");
const router = express.Router();
const { ingestRepo } = require("../controllers/repoController");

router.post("/ingest", ingestRepo);

module.exports = router;
