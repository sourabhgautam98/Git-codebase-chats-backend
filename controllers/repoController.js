const { v4: uuidv4 } = require("uuid");
const { cloneRepo, parseAndChunkCode, cleanupRepo } = require("../utils/repoParser");
const { embedTexts } = require("../services/embeddingService");
const { upsertVectors } = require("../services/pineconeService");
const Chat = require("../models/Chat");

const ingestRepo = async (req, res) => {
  const { repoUrl } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: "repoUrl is required" });
  }

  let localPath = null;

  try {
    const namespace = repoUrl
      .replace(/https?:\/\//, "")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();

    let chatSession = await Chat.findOne({ namespace });
    if (chatSession && chatSession.status === "ready") {
      return res.json({
        message: "Repository already ingested",
        namespace,
        sessionId: chatSession._id,
      });
    }

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

    const { localPath: clonedPath, repoName } = await cloneRepo(repoUrl);
    localPath = clonedPath;

    const chunks = await parseAndChunkCode(localPath);

    if (chunks.length === 0) {
      chatSession.status = "error";
      await chatSession.save();
      return res.status(400).json({ error: "No code files found in repository" });
    }

    console.log("🧠 Generating embeddings...");
    const texts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(texts);
    console.log(`✅ Generated ${embeddings.length} embeddings`);

    const vectors = embeddings.map((values, i) => ({
      id: uuidv4(),
      values,
      metadata: {
        text: chunks[i].text,
        filePath: chunks[i].metadata.filePath,
        chunkIndex: chunks[i].metadata.chunkIndex,
      },
    }));

    console.log("📌 Upserting into Pinecone...");
    await upsertVectors(vectors, namespace);

    chatSession.status = "ready";
    chatSession.repoName = repoName;
    await chatSession.save();

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

    if (localPath) cleanupRepo(localPath);

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
