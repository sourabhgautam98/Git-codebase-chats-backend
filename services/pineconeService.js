const { Pinecone } = require("@pinecone-database/pinecone");

let pineconeClient = null;

/**
 * Get or create a singleton Pinecone client.
 */
const getPineconeClient = () => {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
};

/**
 * Get the target Pinecone index instance.
 */
const getIndex = () => {
  const client = getPineconeClient();
  return client.index(process.env.PINECONE_INDEX_NAME);
};

/**
 * Upsert embedding vectors into Pinecone under a given namespace.
 * @param {Array<{id: string, values: number[], metadata: object}>} vectors
 * @param {string} namespace
 */
const upsertVectors = async (vectors, namespace) => {
  const index = getIndex();
  const ns = index.namespace(namespace);

  // Pinecone recommends batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await ns.upsert(batch);
    console.log(
      `   📌 Upserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} vectors)`
    );
  }
};

/**
 * Query Pinecone for similar vectors.
 * @param {number[]} queryVector
 * @param {string} namespace
 * @param {number} topK
 * @returns {Promise<Array>} matches
 */
const querySimilar = async (queryVector, namespace, topK = 5) => {
  const index = getIndex();
  const ns = index.namespace(namespace);

  const result = await ns.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  });

  return result.matches || [];
};

/**
 * Delete all vectors in a namespace.
 * @param {string} namespace
 */
const deleteNamespace = async (namespace) => {
  const index = getIndex();
  const ns = index.namespace(namespace);
  await ns.deleteAll();
};

module.exports = { upsertVectors, querySimilar, deleteNamespace, getPineconeClient };
