import { Pinecone } from "@pinecone-database/pinecone";

let pineconeClient = null;

const getPineconeClient = () => {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
};

const getIndex = () => {
  const client = getPineconeClient();
  return client.index(process.env.PINECONE_INDEX_NAME);
};

const upsertVectors = async (vectors, namespace) => {
  const index = getIndex();
  const ns = index.namespace(namespace);

  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await ns.upsert(batch);
    console.log(
      `   📌 Upserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} vectors)`
    );
  }
};

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

const deleteNamespace = async (namespace) => {
  const index = getIndex();
  const ns = index.namespace(namespace);
  await ns.deleteAll();
};

export { upsertVectors, querySimilar, deleteNamespace, getPineconeClient };
