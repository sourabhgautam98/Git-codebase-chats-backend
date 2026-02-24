const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;
let embeddingModel = null;

const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONS = 768;

const getEmbeddingModel = () => {
  if (!embeddingModel) {
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  }
  return embeddingModel;
};

const embedText = async (text) => {
  const model = getEmbeddingModel();
  const result = await model.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: OUTPUT_DIMENSIONS,
  });
  return result.embedding.values;
};

const embedTexts = async (texts) => {
  const model = getEmbeddingModel();
  const BATCH_SIZE = 10;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const promises = batch.map((text) =>
      model.embedContent({
        content: { parts: [{ text }] },
        outputDimensionality: OUTPUT_DIMENSIONS,
      })
    );
    const results = await Promise.all(promises);
    allEmbeddings.push(...results.map((r) => r.embedding.values));
  }

  return allEmbeddings;
};

module.exports = { embedText, embedTexts, getEmbeddingModel };
