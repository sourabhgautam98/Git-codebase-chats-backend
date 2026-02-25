import simpleGit from "simple-git";
import fs from "fs";
import path from "path";
// import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const CODE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java",
  ".go", ".rs", ".cpp", ".c", ".h", ".hpp",
  ".rb", ".php", ".cs", ".swift", ".kt",
  ".vue", ".svelte", ".html", ".css", ".scss",
  ".json", ".yaml", ".yml", ".md", ".sql",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  "vendor", "__pycache__", ".venv", "venv",
  "target", "bin", "obj", ".idea", ".vscode",
  "coverage", ".nyc_output",
]);

const cloneRepo = async (repoUrl) => {
  const urlParts = repoUrl.replace(/\.git$/, "").split("/");
  const repoName = urlParts[urlParts.length - 1];
  const owner = urlParts[urlParts.length - 2] || "unknown";

  const localPath = path.join(
    process.cwd(),
    "tmp",
    `${owner}_${repoName}_${Date.now()}`
  );

  if (!fs.existsSync(path.join(process.cwd(), "tmp"))) {
    fs.mkdirSync(path.join(process.cwd(), "tmp"), { recursive: true });
  }

  console.log(`📥 Cloning ${repoUrl} → ${localPath}`);
  const git = simpleGit();
  await git.clone(repoUrl, localPath, ["--depth", "1"]);

  return { localPath, repoName: `${owner}/${repoName}` };
};

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
          if (content.length > 0 && content.length < 100_000) {
            const relativePath = path.relative(basePath, fullPath);
            results.push({ filePath: relativePath, content });
          }
        } catch {
        }
      }
    }
  }

  return results;
};

const parseAndChunkCode = async (dirPath) => {
  const codeFiles = readCodeFiles(dirPath);
  console.log(`📄 Found ${codeFiles.length} code files`);

  const CHUNK_SIZE = 1000;
  const CHUNK_OVERLAP = 200;
  const allChunks = [];

  for (const file of codeFiles) {
    const header = `// File: ${file.filePath}\n`;
    const text = header + file.content;

    if (text.length <= CHUNK_SIZE) {
      allChunks.push({
        text,
        metadata: { filePath: file.filePath, chunkIndex: 0 },
      });
    } else {
      let start = 0;
      let chunkIndex = 0;
      while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        allChunks.push({
          text: text.slice(start, end),
          metadata: { filePath: file.filePath, chunkIndex },
        });
        start += CHUNK_SIZE - CHUNK_OVERLAP;
        chunkIndex++;
      }
    }
  }

  console.log(`🧩 Created ${allChunks.length} chunks`);
  return allChunks;
};

const cleanupRepo = (dirPath) => {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`🗑️  Cleaned up ${dirPath}`);
  } catch {
    console.warn(`⚠️  Could not clean up ${dirPath}`);
  }
};

export { cloneRepo, parseAndChunkCode, cleanupRepo };
