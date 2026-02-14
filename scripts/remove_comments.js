const fs = require("fs");
const path = require("path");

const CONFIG = {
  rootDir: path.join(__dirname, ".."),
  targetDirs: ["src", "app", "scripts"],
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
  srcExtensions: [".ts", ".tsx"],
  appExtensions: [".ts", ".tsx"],
  scriptExtensions: [".js", ".mjs"],
  excludeFiles: ["next-env.d.ts"],
  preservePatterns: [
    "@ts-expect-error",
    "@ts-ignore",
    "@ts-nocheck",
    "@deprecated",
    "@internal",
    "eslint-disable",
    "eslint-enable",
    "eslint-disable-next-line",
    "prettier-ignore",
    "prettier-disable",
    "prettier-enable",
    "TODO",
    "FIXME",
    "HACK",
    "XXX",
    "NOTE",
    "IMPORTANT",
  ],
  dryRun: false,
};

function shouldSkipDir(dirName) {
  return CONFIG.skipDirs.includes(dirName) || dirName.startsWith("tmpclaude-");
}

function shouldProcess(filePath) {
  const basename = path.basename(filePath);

  if (CONFIG.excludeFiles.includes(basename)) {
    return false;
  }

  if (basename.endsWith(".d.ts")) {
    return false;
  }

  const ext = path.extname(filePath);
  const relPath = path.relative(CONFIG.rootDir, filePath);
  const isInSrc = relPath.startsWith("src");
  const isInApp = relPath.startsWith("app");
  const isInScripts = relPath.startsWith("scripts");

  if (isInSrc || isInApp) {
    return (
      CONFIG.srcExtensions.includes(ext) || CONFIG.appExtensions.includes(ext)
    );
  }

  if (isInScripts) {
    return CONFIG.scriptExtensions.includes(ext);
  }

  return false;
}

function shouldPreserveComment(comment) {
  return CONFIG.preservePatterns.some((pattern) => comment.includes(pattern));
}

function removeComments(code) {
  let result = "";
  let i = 0;

  while (i < code.length) {
    const char = code[i];

    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      result += char;
      i++;

      while (i < code.length) {
        if (code[i] === "\\") {
          result += code[i];
          i++;
          if (i < code.length) {
            result += code[i];
            i++;
          }
        } else if (code[i] === quote) {
          result += code[i];
          i++;
          break;
        } else {
          result += code[i];
          i++;
        }
      }
      continue;
    }

    if (code[i] === "/" && i + 1 < code.length && code[i + 1] === "*") {
      let comment = "";
      let startPos = i;
      let j = i;

      while (j < code.length) {
        comment += code[j];
        if (code[j] === "*" && j + 1 < code.length && code[j + 1] === "/") {
          comment += code[++j];
          j++;
          break;
        }
        j++;
      }

      if (shouldPreserveComment(comment)) {
        result += comment;
      } else {
        const newlines = (comment.match(/\n/g) || []).length;
        result += "\n".repeat(newlines);
      }
      i = j;
      continue;
    }

    if (code[i] === "/" && i + 1 < code.length && code[i + 1] === "/") {
      let comment = "";
      let j = i;

      while (j < code.length && code[j] !== "\n") {
        comment += code[j];
        j++;
      }

      if (shouldPreserveComment(comment)) {
        result += comment;
        if (j < code.length && code[j] === "\n") {
          result += "\n";
          j++;
        }
      } else {
        if (j < code.length && code[j] === "\n") {
          j++;
        }
      }
      i = j;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

function removeEmptyLines(code) {
  const lines = code.split("\n");
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      if (i === 0 || i === lines.length - 1) {
        if (i === 0) {
          result.push(line);
        } else {
          result.push(line);
        }
      } else {
        if (result.length > 0 && result[result.length - 1].trim() !== "") {
          result.push(line);
        }
      }
    } else {
      result.push(line);
    }
  }

  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }

  return result.join("\n");
}

function processFile(filePath) {
  try {
    const originalCode = fs.readFileSync(filePath, "utf8");
    let processedCode = removeComments(originalCode);
    processedCode = removeEmptyLines(processedCode);

    if (originalCode === processedCode) {
      return { modified: false };
    }

    const originalComments = (
      originalCode.match(/\/\*[\s\S]*?\*\/|\/\/.*/g) || []
    ).filter((c) => !shouldPreserveComment(c)).length;

    if (!CONFIG.dryRun) {
      fs.writeFileSync(filePath, processedCode, "utf8");
    }

    return { modified: true, commentsRemoved: originalComments };
  } catch (error) {
    return { error: error.message };
  }
}

function getFileList(dir, extensions, baseDir = "") {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = baseDir ? path.join(baseDir, entry.name) : entry.name;

    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        files.push(...getFileList(fullPath, extensions, relativePath));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(fullPath);
      if (extensions.includes(ext) && shouldProcess(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function processDirectory(dir) {
  const stats = {
    processed: 0,
    modified: 0,
    errors: 0,
    commentsRemoved: 0,
    modifiedFiles: [],
  };

  const srcDir = path.join(dir, "src");
  const appDir = path.join(dir, "app");
  const scriptsDir = path.join(dir, "scripts");

  const filesToProcess = [];

  if (fs.existsSync(srcDir)) {
    filesToProcess.push(...getFileList(srcDir, CONFIG.srcExtensions));
  }

  if (fs.existsSync(appDir)) {
    filesToProcess.push(...getFileList(appDir, CONFIG.appExtensions));
  }

  if (fs.existsSync(scriptsDir)) {
    filesToProcess.push(...getFileList(scriptsDir, CONFIG.scriptExtensions));
  }

  for (const filePath of filesToProcess) {
    const result = processFile(filePath);
    stats.processed++;

    if (result.error) {
      console.log(`   ✗ ${path.relative(dir, filePath)}: ${result.error}`);
      stats.errors++;
    } else if (result.modified) {
      const relPath = path.relative(dir, filePath);
      console.log(`   ✓ ${relPath}`);
      stats.modified++;
      stats.commentsRemoved += result.commentsRemoved || 0;
      stats.modifiedFiles.push(relPath);
    }
  }

  return stats;
}

function main() {
  console.log("Removing comments from source files...\n");

  if (CONFIG.dryRun) {
    console.log("DRY RUN MODE - No files will be modified\n");
  }

  const startTime = Date.now();
  const stats = processDirectory(CONFIG.rootDir);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\nComment removal complete!");
  console.log(`Files processed: ${stats.processed}`);
  console.log(`Files modified: ${stats.modified}`);
  console.log(`Comments removed: ${stats.commentsRemoved}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Duration: ${duration}s\n`);

  if (stats.modified > 0) {
    console.log("Modified files:");
    stats.modifiedFiles.forEach((file) => {
      console.log(`  - ${file}`);
    });
    console.log();
  }

  if (stats.errors > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("Error removing comments:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { removeComments, processFile };
