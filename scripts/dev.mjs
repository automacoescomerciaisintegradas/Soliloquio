import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const tsxBin = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const envFile = path.join(root, ".env");

const children = [];

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

const envFromFile = readDotEnv(envFile);

function run(name, args, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, ...envFromFile, ...extraEnv },
  });

  child.stdout?.on("data", data => process.stdout.write(`[${name}] ${data}`));
  child.stderr?.on("data", data => process.stderr.write(`[${name}] ${data}`));

  child.on("exit", code => {
    if (code && code !== 0) {
      console.error(`[${name}] finalizou com código ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("backend", [tsxBin, "server/index.ts"], {
  NODE_ENV: "development",
  PORT: "3001",
});
run("frontend", [viteBin, "--host", "--port", "3000", "--strictPort"]);
