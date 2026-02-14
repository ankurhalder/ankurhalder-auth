const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const CONFIG = {
  skipRemoveComments: false,
  skipFormat: false,
  skipLint: false,
  skipTypeCheck: false,
  skipBuild: false,
  skipCrawl: false,
  skipArchValidation: false,
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, total, message) {
  log(`\n[${step}/${total}] ${message}`, "cyan");
  log("─".repeat(60), "cyan");
}

function exec(command, description) {
  try {
    execSync(command, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });
    log(`✓ ${description} passed`, "green");
    return true;
  } catch (error) {
    log(`✗ ${description} failed`, "red");
    throw error;
  }
}

function hasStagedSourceChanges() {
  try {
    const output = execSync("git diff --cached --name-only", {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
    });

    const stagedFiles = output.trim().split("\n").filter(Boolean);

    const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
    return stagedFiles.some((file) =>
      sourceExtensions.some((ext) => file.endsWith(ext))
    );
  } catch (error) {
    return false;
  }
}

async function removeComments() {
  if (CONFIG.skipRemoveComments) {
    log("⊘ Skipping comment removal", "yellow");
    return;
  }

  const scriptPath = path.join(__dirname, "remove_comments.js");

  if (fs.existsSync(scriptPath)) {
    exec(`node "${scriptPath}"`, "Comment removal");
  } else {
    log("⊘ remove_comments.js not found, skipping", "yellow");
  }
}

async function formatCode() {
  if (CONFIG.skipFormat) {
    log("⊘ Skipping code formatting", "yellow");
    return;
  }

  const packageJson = require(path.join(__dirname, "..", "package.json"));

  if (packageJson.scripts && packageJson.scripts.format) {
    exec("npm run format", "Code formatting");
  } else {
    log("⊘ No format script found, skipping", "yellow");
  }
}

async function lintCode() {
  if (CONFIG.skipLint) {
    log("⊘ Skipping linting", "yellow");
    return;
  }

  exec("npx eslint . --max-warnings=0", "ESLint validation");
}

async function typeCheck() {
  if (CONFIG.skipTypeCheck) {
    log("⊘ Skipping type check", "yellow");
    return;
  }

  exec("npm run type-check", "TypeScript type checking");
}

async function buildProject() {
  if (CONFIG.skipBuild) {
    log("⊘ Skipping build", "yellow");
    return;
  }

  if (!hasStagedSourceChanges()) {
    log("⊘ No source changes, skipping build", "yellow");
    return;
  }

  exec("npm run build", "Next.js build");
}

async function generateProjectTree() {
  if (CONFIG.skipCrawl) {
    log("⊘ Skipping project crawl", "yellow");
    return;
  }

  const scriptPath = path.join(__dirname, "crawl-project.js");

  if (fs.existsSync(scriptPath)) {
    exec(`node "${scriptPath}"`, "Project tree generation");
  } else {
    log("⊘ crawl-project.js not found, skipping", "yellow");
  }
}

async function validateArchitecturalBoundaries() {
  if (CONFIG.skipArchValidation) {
    log("⊘ Skipping architectural validation", "yellow");
    return;
  }

  log("Validating DDD layer boundaries...", "cyan");

  const glob = require("glob");
  const violations = [];

  const rootDir = path.join(__dirname, "..");

  function checkImports(
    filePath,
    allowedPatterns,
    restrictedPatterns,
    layerName
  ) {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      restrictedPatterns.forEach((pattern) => {
        const regex = new RegExp(`from\\s+['"]${pattern}`, "i");
        if (regex.test(line)) {
          violations.push({
            file: path.relative(rootDir, filePath),
            line: index + 1,
            message: `${layerName} layer cannot import from ${pattern}`,
            code: line.trim(),
          });
        }
      });
    });
  }

  const domainFiles = glob.sync("src/domain/**/*.ts", { cwd: rootDir });
  domainFiles.forEach((file) => {
    checkImports(
      path.join(rootDir, file),
      [],
      [
        "@app/",
        "@infra/",
        "@presentation/",
        "next/",
        "mongodb",
        "@upstash/",
        "@getbrevo/",
      ],
      "Domain"
    );
  });

  const appFiles = glob.sync("src/application/**/*.ts", { cwd: rootDir });
  appFiles.forEach((file) => {
    checkImports(
      path.join(rootDir, file),
      ["@domain/"],
      [
        "@infra/database/",
        "@infra/email/",
        "@presentation/",
        "next/",
        "mongodb",
        "@upstash/",
      ],
      "Application"
    );
  });

  const infraFiles = glob.sync("src/infrastructure/**/*.ts", { cwd: rootDir });
  infraFiles.forEach((file) => {
    checkImports(
      path.join(rootDir, file),
      ["@domain/", "@app/"],
      ["@presentation/"],
      "Infrastructure"
    );
  });

  if (violations.length > 0) {
    log("", "reset");
    log("✗ Architectural boundary violations detected:", "red");
    log("", "reset");

    violations.forEach((v) => {
      log(`  ${v.file}:${v.line}`, "yellow");
      log(`    ${v.message}`, "red");
      log(`    ${v.code}`, "magenta");
      log("", "reset");
    });

    throw new Error(`Found ${violations.length} architectural violations`);
  }

  log("✓ No architectural boundary violations", "green");
}

async function preCommit() {
  const startTime = Date.now();

  log("", "reset");
  log("═".repeat(60), "bright");
  log("  PRE-COMMIT VALIDATION", "bright");
  log("═".repeat(60), "bright");
  log("", "reset");

  const totalSteps = 7;
  let currentStep = 0;

  try {
    logStep(++currentStep, totalSteps, "Removing comments");
    await removeComments();

    logStep(++currentStep, totalSteps, "Formatting code");
    await formatCode();

    logStep(++currentStep, totalSteps, "Linting code");
    await lintCode();

    logStep(++currentStep, totalSteps, "Type checking");
    await typeCheck();

    logStep(++currentStep, totalSteps, "Building project");
    await buildProject();

    logStep(++currentStep, totalSteps, "Generating project tree");
    await generateProjectTree();

    logStep(++currentStep, totalSteps, "Validating architectural boundaries");
    await validateArchitecturalBoundaries();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log("", "reset");
    log("═".repeat(60), "green");
    log("  ✅ ALL CHECKS PASSED!", "green");
    log(`  Duration: ${duration}s`, "green");
    log("═".repeat(60), "green");
    log("", "reset");

    process.exit(0);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log("", "reset");
    log("═".repeat(60), "red");
    log("  ❌ PRE-COMMIT VALIDATION FAILED", "red");
    log(`  Duration: ${duration}s`, "red");
    log("═".repeat(60), "red");
    log("", "reset");

    log("Please fix the errors above before committing.", "yellow");
    log("", "reset");

    process.exit(1);
  }
}

if (require.main === module) {
  try {
    require("glob");
  } catch (error) {
    log("⚠️  glob package not found. Install dependencies first:", "yellow");
    log("   npm install", "yellow");
    log("", "reset");
    process.exit(1);
  }

  preCommit().catch((error) => {
    log("", "reset");
    log("❌ Unexpected error:", "red");
    log(error.message, "red");
    log("", "reset");
    process.exit(1);
  });
}

module.exports = { preCommit };
