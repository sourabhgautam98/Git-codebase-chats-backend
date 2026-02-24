import { embedText } from "../services/embeddingService.js";
import { querySimilar } from "../services/pineconeService.js";
import { generateAnswer } from "../services/geminiService.js";
import Chat from "../models/Chat.js";

const askQuestion = async (req, res) => {
  const { sessionId, question } = req.body;

  if (!sessionId || !question) {
    return res.status(400).json({ error: "sessionId and question are required" });
  }

  try {
    const chatSession = await Chat.findById(sessionId);
    if (!chatSession) {
      return res.status(404).json({ error: "Chat session not found" });
    }

    if (chatSession.status !== "ready") {
      return res.status(400).json({ error: "Repository is still being processed" });
    }

    console.log(`\n💬 Question: "${question}" (repo: ${chatSession.repoName})`);

    const queryVector = await embedText(question);

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

    const answer = await generateAnswer(context, question);

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

export { askQuestion, getSessions, getHistory };
