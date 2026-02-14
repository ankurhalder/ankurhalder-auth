import {
  readFileSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  unlinkSync,
} from "fs";
import { execSync } from "child_process";

const packageJsonPath = "./package.json";

function validatePrerequisites() {
  if (!existsSync(packageJsonPath)) {
    console.error(`❌ ERROR: package.json not found at ${packageJsonPath}`);
    process.exit(1);
  }

  try {
    execSync("git --version", { stdio: "ignore" });
  } catch {
    console.error("❌ ERROR: Git is not available in PATH");
    process.exit(1);
  }

  try {
    execSync("git rev-parse --git-dir", { stdio: "ignore" });
  } catch {
    console.error("❌ ERROR: Not in a git repository");
    process.exit(1);
  }
}

function loadPackageJson() {
  try {
    const content = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(content);

    if (!packageJson.version) {
      console.error("❌ ERROR: package.json does not contain a version field");
      process.exit(1);
    }

    return packageJson;
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("❌ ERROR: package.json contains invalid JSON");
      console.error(`   ${err.message}`);
    } else {
      console.error("❌ ERROR: Failed to read package.json");
      console.error(`   ${err.message}`);
    }
    process.exit(1);
  }
}

function parseVersion(version) {
  if (typeof version !== "string") {
    console.error(`❌ ERROR: Version must be a string, got ${typeof version}`);
    process.exit(1);
  }

  const versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
  const match = version.match(versionRegex);

  if (!match) {
    console.error(`❌ ERROR: Invalid version format: ${version}`);
    console.error("   Expected format: X.Y.Z (e.g., 1.0.0)");
    process.exit(1);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function incrementVersion(version) {
  const { major } = version;
  let { minor, patch } = version;

  patch += 1;

  if (patch >= 10) {
    patch = 0;
    minor += 1;
  }

  return `${major}.${minor}.${patch}`;
}

function safeWritePackageJson(packageJson) {
  const tempPath = `${packageJsonPath}.tmp`;
  const backupPath = `${packageJsonPath}.backup`;

  try {
    if (existsSync(packageJsonPath)) {
      copyFileSync(packageJsonPath, backupPath);
    }

    const content = JSON.stringify(packageJson, null, 2) + "\n";
    writeFileSync(tempPath, content, "utf8");

    const written = readFileSync(tempPath, "utf8");
    if (written !== content) {
      throw new Error("File content verification failed");
    }

    try {
      JSON.parse(written);
    } catch {
      throw new Error("Generated file contains invalid JSON");
    }

    if (existsSync(packageJsonPath)) {
      unlinkSync(packageJsonPath);
    }
    copyFileSync(tempPath, packageJsonPath);
    unlinkSync(tempPath);

    if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }
  } catch (err) {
    if (existsSync(backupPath)) {
      if (existsSync(packageJsonPath)) {
        unlinkSync(packageJsonPath);
      }
      copyFileSync(backupPath, packageJsonPath);
      unlinkSync(backupPath);
    }

    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }

    throw err;
  }
}

function stagePackageJson() {
  try {
    execSync("git add package.json", { stdio: "pipe" });
  } catch (err) {
    console.error("❌ ERROR: Failed to stage package.json");
    console.error(`   ${err.message}`);
    throw err;
  }
}

function main() {
  console.warn(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  console.warn("  VERSION INCREMENT");
  console.warn(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  console.warn("");

  try {
    validatePrerequisites();

    const packageJson = loadPackageJson();
    const currentVersion = packageJson.version;

    console.warn(`Current version: ${currentVersion}`);

    const parsedVersion = parseVersion(currentVersion);

    const newVersion = incrementVersion(parsedVersion);

    console.warn(`New version:     ${newVersion}`);

    packageJson.version = newVersion;

    safeWritePackageJson(packageJson);

    stagePackageJson();

    console.warn("");
    console.warn(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.warn(`✅ SUCCESS: Version incremented`);
    console.warn(`   ${currentVersion} → ${newVersion}`);
    console.warn(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.warn("");

    process.exit(0);
  } catch (err) {
    console.warn("");
    console.warn(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.error("❌ FAILED: Version increment failed");
    console.error(`   ${err.message}`);
    if (err.stack) {
      console.error(`   Stack: ${err.stack}`);
    }
    console.warn(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.warn("");

    process.exit(1);
  }
}

main();
