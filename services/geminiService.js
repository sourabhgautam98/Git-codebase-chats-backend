const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;
let model = null;

const GEMINI_MODEL = "gemini-2.0-flash";

/**
 * Get or create a singleton Gemini model instance.
 */
const getModel = () => {
  if (!model) {
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
    });
  }
  return model;
};

const PROMPT_TEMPLATE = `You are an expert code assistant. You are given relevant code snippets from a codebase and a developer's question.

Answer the question accurately based on the provided code context. If the answer is not in the context, say so honestly. Include code examples when relevant. Format your answer in Markdown.

**Code Context:**
{context}

**Question:** {question}

**Answer:**`;

/**
 * Generate an answer given code context and a user question.
 * @param {string} context - concatenated relevant code chunks
 * @param {string} question - user's question
 * @returns {Promise<string>} the generated answer
 */
const generateAnswer = async (context, question) => {
  const gemini = getModel();

  const prompt = PROMPT_TEMPLATE
    .replace("{context}", context)
    .replace("{question}", question);

  const result = await gemini.generateContent(prompt);
  const response = await result.response;
  return response.text();
};

module.exports = { generateAnswer };
