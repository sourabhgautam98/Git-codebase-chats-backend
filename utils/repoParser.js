const simpleGit = require("simple-git");
const fs = require("fs");
const path = require("path");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");

// Supported code file extensions
const CODE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java",
  ".go", ".rs", ".cpp", ".c", ".h", ".hpp",
  ".rb", ".php", ".cs", ".swift", ".kt",
  ".vue", ".svelte", ".html", ".css", ".scss",
  ".json", ".yaml", ".yml", ".md", ".sql",
]);

// Directories to always skip
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  "vendor", "__pycache__", ".venv", "venv",
  "target", "bin", "obj", ".idea", ".vscode",
  "coverage", ".nyc_output",
]);

/**
 * Clone a GitHub repo to a temp directory.
 * @param {string} repoUrl
 * @returns {Promise<{localPath: string, repoName: string}>}
 */
const cloneRepo = async (repoUrl) => {
  // Extract repo name from URL
  const urlParts = repoUrl.replace(/\.git$/, "").split("/");
  const repoName = urlParts[urlParts.length - 1];
  const owner = urlParts[urlParts.length - 2] || "unknown";

  const localPath = path.join(
    process.cwd(),
    "tmp",
    `${owner}_${repoName}_${Date.now()}`
  );

  // Create tmp dir if needed
  if (!fs.existsSync(path.join(process.cwd(), "tmp"))) {
    fs.mkdirSync(path.join(process.cwd(), "tmp"), { recursive: true });
  }

  console.log(`📥 Cloning ${repoUrl} → ${localPath}`);
  const git = simpleGit();
  await git.clone(repoUrl, localPath, ["--depth", "1"]); // shallow clone

  return { localPath, repoName: `${owner}/${repoName}` };
};

/**
 * Recursively read all code files from a directory.
 * @param {string} dirPath
 * @returns {Array<{filePath: string, content: string}>}
 */
const readCodeFiles = (dirPath, basePath = dirPath) => {
  const results = [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        results.push(...readCodeFiles(fullPath, basePath));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTENSIONS.has(ext)) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          // Skip very large files (> 100KB) and empty files
          if (content.length > 0 && content.length < 100_000) {
            const relativePath = path.relative(basePath, fullPath);
            results.push({ filePath: relativePath, content });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  return results;
};

/**
 * Parse code files into LangChain-chunked documents.
 * @param {string} dirPath - path to cloned repo
 * @returns {Promise<Array<{text: string, metadata: {filePath: string, chunkIndex: number}}>>}
 */
const parseAndChunkCode = async (dirPath) => {
  const codeFiles = readCodeFiles(dirPath);
  console.log(`📄 Found ${codeFiles.length} code files`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const allChunks = [];

  for (const file of codeFiles) {
    const header = `// File: ${file.filePath}\n`;
    const docs = await splitter.createDocuments(
      [header + file.content],
      [{ filePath: file.filePath }]
    );

    docs.forEach((doc, i) => {
      allChunks.push({
        text: doc.pageContent,
        metadata: {
          filePath: file.filePath,
          chunkIndex: i,
        },
      });
    });
  }

  console.log(`🧩 Created ${allChunks.length} chunks`);
  return allChunks;
};

/**
 * Cleanup cloned repo directory.
 * @param {string} dirPath
 */
const cleanupRepo = (dirPath) => {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`🗑️  Cleaned up ${dirPath}`);
  } catch {
    console.warn(`⚠️  Could not clean up ${dirPath}`);
  }
};

module.exports = { cloneRepo, parseAndChunkCode, cleanupRepo };
