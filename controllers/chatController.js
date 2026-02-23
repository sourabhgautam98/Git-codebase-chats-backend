const { embedText } = require("../services/embeddingService");
const { querySimilar } = require("../services/pineconeService");
const { generateAnswer } = require("../services/geminiService");
const Chat = require("../models/Chat");

/**
 * POST /api/chat/query
 * Body: { sessionId: string, question: string }
 */
const askQuestion = async (req, res) => {
  const { sessionId, question } = req.body;

  if (!sessionId || !question) {
    return res.status(400).json({ error: "sessionId and question are required" });
  }

  try {
    // 1. Find the chat session
    const chatSession = await Chat.findById(sessionId);
    if (!chatSession) {
      return res.status(404).json({ error: "Chat session not found" });
    }

    if (chatSession.status !== "ready") {
      return res.status(400).json({ error: "Repository is still being processed" });
    }

    console.log(`\n💬 Question: "${question}" (repo: ${chatSession.repoName})`);

    // 2. Embed the question
    const queryVector = await embedText(question);

    // 3. Similarity search in Pinecone
    const matches = await querySimilar(queryVector, chatSession.namespace, 5);

    if (matches.length === 0) {
      const noContextAnswer =
        "I couldn't find any relevant code in the repository for your question. Please try rephrasing or ask about a specific file or function.";

      chatSession.messages.push(
        { role: "user", content: question },
        { role: "assistant", content: noContextAnswer }
      );
      await chatSession.save();

      return res.json({ answer: noContextAnswer, sources: [] });
    }

    // 4. Build context from matched chunks
    const context = matches
      .map((match) => {
        const filePath = match.metadata?.filePath || "unknown";
        const text = match.metadata?.text || "";
        return `--- ${filePath} ---\n${text}`;
      })
      .join("\n\n");

    const sources = [
      ...new Set(matches.map((m) => m.metadata?.filePath).filter(Boolean)),
    ];

    console.log(`📎 Found ${matches.length} relevant chunks from: ${sources.join(", ")}`);

    // 5. Generate answer with Gemini
    const answer = await generateAnswer(context, question);

    // 6. Save messages to chat history
    chatSession.messages.push(
      { role: "user", content: question },
      { role: "assistant", content: answer }
    );
    await chatSession.save();

    console.log(`✅ Answer generated (${answer.length} chars)`);

    res.json({ answer, sources });
  } catch (error) {
    console.error("❌ Query error:", error.message);
    res.status(500).json({ error: "Failed to process question", details: error.message });
  }
};

/**
 * GET /api/chat/sessions
 * Returns all chat sessions.
 */
const getSessions = async (req, res) => {
  try {
    const sessions = await Chat.find({})
      .select("repoUrl repoName namespace status createdAt updatedAt")
      .sort({ updatedAt: -1 });

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
};

/**
 * GET /api/chat/history/:sessionId
 * Returns chat history for a specific session.
 */
const getHistory = async (req, res) => {
  try {
    const session = await Chat.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({
      repoUrl: session.repoUrl,
      repoName: session.repoName,
      status: session.status,
      messages: session.messages,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
};

module.exports = { askQuestion, getSessions, getHistory };
