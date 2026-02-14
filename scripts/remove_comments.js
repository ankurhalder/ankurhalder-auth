#!/usr/bin/env node

/**
 * Remove Comments Script
 *
 * Removes comments from TypeScript and JavaScript files while preserving:
 * - @ts-expect-error, @ts-ignore, @ts-nocheck directives
 * - ESLint disable comments
 * - TODO, FIXME, NOTE comments
 * - JSDoc comments (optional)
 *
 * Usage:
 *   node scripts/remove_comments.js
 *
 * This script processes:
 * - .ts, .tsx, .js, .jsx, .mjs, .cjs files
 * - Excludes: node_modules, .next, .git, type declaration files
 */

const fs = require("fs");
const path = require("path");

const CONFIG = {
  rootDir: path.join(__dirname, ".."),

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

  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],

  excludeFiles: ["next-env.d.ts"],

  preserve: [
    "@ts-expect-error",
    "@ts-ignore",
    "@ts-nocheck",
    "eslint-disable",
    "eslint-enable",
    "prettier-ignore",
    "TODO:",
    "FIXME:",
    "NOTE:",
    "HACK:",
    "XXX:",
    "IMPORTANT:",
  ],

  preserveJSDoc: true,

  dryRun: false,
};

/**
 * Check if file should be processed
 */
function shouldProcess(filePath) {
  const basename = path.basename(filePath);

  if (CONFIG.excludeFiles.includes(basename)) {
    return false;
  }

  if (basename.endsWith(".d.ts")) {
    return false;
  }

  const ext = path.extname(filePath);
  return CONFIG.extensions.includes(ext);
}

/**
 * Check if directory should be skipped
 */
function shouldSkipDir(dirName) {
  return CONFIG.skipDirs.includes(dirName) || dirName.startsWith("tmpclaude-");
}

/**
 * Check if comment should be preserved
 */
function shouldPreserveComment(comment) {
  return CONFIG.preserve.some((pattern) => comment.includes(pattern));
}

/**
 * Check if comment is JSDoc
 */
function isJSDocComment(comment) {
  return comment.trim().startsWith("/**") && comment.trim().includes("*/");
}

/**
 * Remove comments from code
 */
function removeComments(code) {
  let result = "";
  let i = 0;

  while (i < code.length) {
    if (code[i] === '"' || code[i] === "'" || code[i] === "`") {
      const quote = code[i];
      result += code[i++];

      while (i < code.length) {
        if (code[i] === "\\") {
          result += code[i++];
          if (i < code.length) {
            result += code[i++];
          }
        } else if (code[i] === quote) {
          result += code[i++];
          break;
        } else {
          result += code[i++];
        }
      }
      continue;
    }

    if (code[i] === "/" && i + 1 < code.length && code[i + 1] === "*") {
      let comment = "";
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
        i = j;
      } else if (CONFIG.preserveJSDoc && isJSDocComment(comment)) {
        result += comment;
        i = j;
      } else {
        const newlines = (comment.match(/\n/g) || []).length;
        result += "\n".repeat(newlines);
        i = j;
      }
      continue;
    }

    if (code[i] === "/" && i + 1 < code.length && code[i + 1] === "/") {
      let comment = "";
      let j = i;

      while (j < code.length && code[j] !== "\n") {
        comment += code[j++];
      }

      if (shouldPreserveComment(comment)) {
        result += comment;
        if (j < code.length) {
          result += code[j++];
        }
        i = j;
      } else {
        i = j;
        if (i < code.length && code[i] === "\n") {
          result += code[i++];
        }
      }
      continue;
    }

    result += code[i++];
  }

  return result;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const originalCode = fs.readFileSync(filePath, "utf8");
    const processedCode = removeComments(originalCode);

    if (originalCode === processedCode) {
      return { modified: false };
    }

    const originalLines = originalCode.split("\n").length;
    const processedLines = processedCode.split("\n").length;
    const linesRemoved = originalLines - processedLines;

    if (!CONFIG.dryRun) {
      fs.writeFileSync(filePath, processedCode, "utf8");
    }

    return { modified: true, linesRemoved };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Recursively process directory
 */
function processDirectory(
  dir,
  stats = { processed: 0, modified: 0, errors: 0 }
) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        processDirectory(fullPath, stats);
      }
    } else if (entry.isFile() && shouldProcess(fullPath)) {
      const result = processFile(fullPath);
      stats.processed++;

      if (result.error) {
        console.error(
          `   ✗ ${path.relative(CONFIG.rootDir, fullPath)}: ${result.error}`
        );
        stats.errors++;
      } else if (result.modified) {
        console.log(`   ✓ ${path.relative(CONFIG.rootDir, fullPath)}`);
        stats.modified++;
      }
    }
  }

  return stats;
}

/**
 * Main function
 */
function main() {
  console.log("🧹 Removing comments from source files...\n");

  if (CONFIG.dryRun) {
    console.log("⚠️  DRY RUN MODE - No files will be modified\n");
  }

  const startTime = Date.now();

  const stats = processDirectory(CONFIG.rootDir);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n✅ Comment removal complete!");
  console.log(`   Files processed: ${stats.processed}`);
  console.log(`   Files modified: ${stats.modified}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Duration: ${duration}s\n`);

  if (CONFIG.preserveJSDoc) {
    console.log("ℹ️  JSDoc comments were preserved");
  }

  console.log("ℹ️  Preserved comments:");
  CONFIG.preserve.forEach((pattern) => {
    console.log(`   - ${pattern}`);
  });
  console.log();

  if (stats.errors > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("\n❌ Error removing comments:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { removeComments, processFile };
