const { v4: uuidv4 } = require("uuid");
const { cloneRepo, parseAndChunkCode, cleanupRepo } = require("../utils/repoParser");
const { embedTexts } = require("../services/embeddingService");
const { upsertVectors } = require("../services/pineconeService");
const Chat = require("../models/Chat");

/**
 * POST /api/repo/ingest
 * Body: { repoUrl: string }
 *
 * Orchestrates: clone → parse → chunk → embed → upsert into Pinecone
 */
const ingestRepo = async (req, res) => {
  const { repoUrl } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: "repoUrl is required" });
  }

  let localPath = null;

  try {
    // Create a namespace from the repo URL
    const namespace = repoUrl
      .replace(/https?:\/\//, "")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();

    // Check if already ingested
    let chatSession = await Chat.findOne({ namespace });
    if (chatSession && chatSession.status === "ready") {
      return res.json({
        message: "Repository already ingested",
        namespace,
        sessionId: chatSession._id,
      });
    }

    // Create or update chat session
    if (!chatSession) {
      chatSession = new Chat({
        repoUrl,
        repoName: repoUrl.split("/").slice(-2).join("/").replace(/\.git$/, ""),
        namespace,
        status: "ingesting",
        messages: [],
      });
      await chatSession.save();
    } else {
      chatSession.status = "ingesting";
      await chatSession.save();
    }

    console.log(`\n🚀 Starting ingestion for: ${repoUrl}`);

    // 1. Clone repo
    const { localPath: clonedPath, repoName } = await cloneRepo(repoUrl);
    localPath = clonedPath;

    // 2. Parse and chunk code files
    const chunks = await parseAndChunkCode(localPath);

    if (chunks.length === 0) {
      chatSession.status = "error";
      await chatSession.save();
      return res.status(400).json({ error: "No code files found in repository" });
    }

    // 3. Generate embeddings
    console.log("🧠 Generating embeddings...");
    const texts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(texts);
    console.log(`✅ Generated ${embeddings.length} embeddings`);

    // 4. Prepare vectors for Pinecone
    const vectors = embeddings.map((values, i) => ({
      id: uuidv4(),
      values,
      metadata: {
        text: chunks[i].text,
        filePath: chunks[i].metadata.filePath,
        chunkIndex: chunks[i].metadata.chunkIndex,
      },
    }));

    // 5. Upsert into Pinecone
    console.log("📌 Upserting into Pinecone...");
    await upsertVectors(vectors, namespace);

    // 6. Update session status
    chatSession.status = "ready";
    chatSession.repoName = repoName;
    await chatSession.save();

    // 7. Cleanup cloned repo
    cleanupRepo(localPath);

    console.log(`\n✅ Ingestion complete for ${repoUrl}\n`);

    res.json({
      message: "Repository ingested successfully",
      namespace,
      sessionId: chatSession._id,
      stats: {
        filesProcessed: chunks.length,
        vectorsStored: vectors.length,
      },
    });
  } catch (error) {
    console.error("❌ Ingestion error:", error.message);

    // Cleanup on failure
    if (localPath) cleanupRepo(localPath);

    // Update session status
    try {
      const namespace = repoUrl
        .replace(/https?:\/\//, "")
        .replace(/[^a-zA-Z0-9]/g, "-")
        .toLowerCase();
      await Chat.findOneAndUpdate({ namespace }, { status: "error" });
    } catch {}

    res.status(500).json({ error: "Failed to ingest repository", details: error.message });
  }
};

module.exports = { ingestRepo };
