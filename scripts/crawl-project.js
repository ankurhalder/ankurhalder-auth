const fs = require("fs");
const path = require("path");

const CONFIG = {
  rootDir: path.join(__dirname, ".."),

  outputFile: "complete-codebase.txt",

  skipDirs: [
    "node_modules",
    ".next",
    ".git",
    "coverage",
    "dist",
    "build",
    "out",
    ".vercel",
    ".husky",
  ],

  skipFiles: [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "complete-codebase.txt",
    ".DS_Store",
    "tsconfig.tsbuildinfo",
  ],

  skipExtensions: [
    ".pem",
    ".key",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".backup",
    ".tmp",
    ".log",
  ],

  includeExtensions: [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".md",
    ".txt",
    ".env.example",
    ".gitignore",
    ".eslintrc",
    ".prettierrc",
    "Dockerfile",
    ".sh",
    ".yml",
    ".yaml",
  ],
};

function shouldSkip(filePath, stats) {
  const basename = path.basename(filePath);

  if (stats.isDirectory()) {
    return (
      CONFIG.skipDirs.includes(basename) || basename.startsWith("tmpclaude-")
    );
  }

  if (CONFIG.skipFiles.includes(basename)) {
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (CONFIG.skipExtensions.includes(ext)) {
    return true;
  }

  if (CONFIG.includeExtensions.length > 0) {
    const hasValidExt = CONFIG.includeExtensions.some((validExt) => {
      if (validExt.startsWith(".")) {
        return ext === validExt;
      }
      return basename === validExt;
    });

    if (!hasValidExt) {
      return true;
    }
  }

  return false;
}

function generateTree(dir, prefix = "", isLast = true) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const filtered = entries.filter((entry) => {
    const fullPath = path.join(dir, entry.name);
    return !shouldSkip(fullPath, entry);
  });

  let output = "";

  filtered.forEach((entry, index) => {
    const isLastEntry = index === filtered.length - 1;
    const connector = isLastEntry ? "└── " : "├── ";
    const fullPath = path.join(dir, entry.name);

    output += `${prefix}${connector}${entry.name}\n`;

    if (entry.isDirectory()) {
      const newPrefix = prefix + (isLastEntry ? "    " : "│   ");
      output += generateTree(fullPath, newPrefix, isLastEntry);
    }
  });

  return output;
}

function crawlDirectory(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (shouldSkip(fullPath, entry)) {
      continue;
    }

    if (entry.isDirectory()) {
      crawlDirectory(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return `[Error reading file: ${error.message}]`;
  }
}

function getRelativePath(filePath) {
  return path.relative(CONFIG.rootDir, filePath);
}

function crawlProject() {
  console.log("🔍 Starting project crawl...\n");

  const startTime = Date.now();
  const outputPath = path.join(CONFIG.rootDir, CONFIG.outputFile);

  console.log("📂 Scanning directories...");
  const files = crawlDirectory(CONFIG.rootDir);
  console.log(`   Found ${files.length} files\n`);

  console.log("🌳 Generating directory tree...");
  const projectName = path.basename(CONFIG.rootDir);
  const tree = `${projectName}/\n${generateTree(CONFIG.rootDir)}`;

  console.log("📝 Building output file...");
  let output = "";

  output += "=".repeat(80) + "\n";
  output += "COMPLETE CODEBASE\n";
  output += "=".repeat(80) + "\n";
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Project: ${projectName}\n`;
  output += `Total Files: ${files.length}\n`;
  output += "=".repeat(80) + "\n\n";

  output += "=".repeat(80) + "\n";
  output += "DIRECTORY STRUCTURE\n";
  output += "=".repeat(80) + "\n\n";
  output += tree + "\n\n";

  output += "=".repeat(80) + "\n";
  output += "FILE CONTENTS\n";
  output += "=".repeat(80) + "\n\n";

  files.forEach((file, index) => {
    const relativePath = getRelativePath(file);
    const content = readFileContent(file);

    output += "-".repeat(80) + "\n";
    output += `File: ${relativePath}\n`;
    output += "-".repeat(80) + "\n\n";
    output += content;
    output += "\n\n";

    if ((index + 1) % 50 === 0) {
      console.log(`   Processed ${index + 1}/${files.length} files...`);
    }
  });

  output += "=".repeat(80) + "\n";
  output += "END OF CODEBASE\n";
  output += "=".repeat(80) + "\n";

  console.log(`\n💾 Writing output to ${CONFIG.outputFile}...`);
  fs.writeFileSync(outputPath, output, "utf8");

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(2);

  console.log("\n✅ Project crawl complete!");
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Output size: ${sizeKB} KB`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Output file: ${outputPath}\n`);
}

if (require.main === module) {
  try {
    crawlProject();
  } catch (error) {
    console.error("\n❌ Error during crawl:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { crawlProject };
