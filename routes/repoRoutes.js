import express from "express";
import { ingestRepo } from "../controllers/repoController.js";

const router = express.Router();

router.post("/ingest", ingestRepo);

export default router;
