import { execSync } from "child_process";
import { rmSync, existsSync } from "fs";
import { join } from "path";

const projectDir = "/vercel/share/v0-project";

// Clean up directories that cause conflicts
const dirsToRemove = [
  join(projectDir, "node_modules"),
  join(projectDir, ".next"),
];

for (const dir of dirsToRemove) {
  if (existsSync(dir)) {
    console.log(`Removing ${dir}...`);
    try {
      rmSync(dir, { recursive: true, force: true });
      console.log(`Removed ${dir}`);
    } catch (err) {
      console.log(`Warning: Could not fully remove ${dir}: ${err.message}`);
    }
  }
}

// Remove package-lock.json
const lockFile = join(projectDir, "package-lock.json");
if (existsSync(lockFile)) {
  console.log("Removing package-lock.json...");
  rmSync(lockFile, { force: true });
}

// Clean npm cache
console.log("Cleaning npm cache...");
try {
  execSync("npm cache clean --force", { cwd: projectDir, stdio: "inherit" });
} catch (err) {
  console.log("Warning: npm cache clean failed, continuing...");
}

// Fresh install with force flag to avoid ENOTEMPTY issues
console.log("Running npm install --force...");
try {
  execSync("npm install --force", { cwd: projectDir, stdio: "inherit", timeout: 120000 });
  console.log("Dependencies installed successfully!");
} catch (err) {
  console.log("npm install --force failed, trying with --legacy-peer-deps...");
  try {
    execSync("npm install --legacy-peer-deps", { cwd: projectDir, stdio: "inherit", timeout: 120000 });
    console.log("Dependencies installed successfully with --legacy-peer-deps!");
  } catch (err2) {
    console.error("Failed to install dependencies:", err2.message);
  }
}
