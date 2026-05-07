#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const cwd = process.cwd();
const args = process.argv.slice(2);
const explicitSession = args.find((arg) => !arg.startsWith("-"));
const json = args.includes("--json");

const piRootCandidates = [
  process.env.PI_CODING_AGENT_MODULE_DIR,
  "/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent",
  "/usr/local/lib/node_modules/@mariozechner/pi-coding-agent"
].filter(Boolean);

function encodeSessionDir(projectPath) {
  return `--${projectPath.replace(/^\/+/, "").replaceAll("/", "-")}--`;
}

function getAgentDir() {
  return process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
}

function getSessionDir(projectPath) {
  return (
    process.env.PI_CODING_AGENT_SESSION_DIR ||
    path.join(getAgentDir(), "sessions", encodeSessionDir(projectPath))
  );
}

function findLatestSessionFile(projectPath) {
  const dir = getSessionDir(projectPath);
  if (!fs.existsSync(dir)) {
    throw new Error(`Session directory not found: ${dir}`);
  }
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".jsonl"))
    .map((file) => path.join(dir, file))
    .map((file) => ({ file, mtimeMs: fs.statSync(file).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!files.length) {
    throw new Error(`No Pi session files found in: ${dir}`);
  }
  return files[0].file;
}

function resolveSessionFile(value) {
  if (!value) return findLatestSessionFile(cwd);
  const resolved = path.resolve(value);
  if (fs.existsSync(resolved)) return resolved;

  const dir = getSessionDir(cwd);
  if (!fs.existsSync(dir)) {
    throw new Error(`Session directory not found: ${dir}`);
  }
  const matches = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".jsonl") && file.includes(value))
    .map((file) => path.join(dir, file));

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`Session id fragment matched multiple files:\n${matches.join("\n")}`);
  }
  throw new Error(`Session file or id fragment not found: ${value}`);
}

async function importPiModule(relativePath) {
  const tried = [];
  for (const root of piRootCandidates) {
    const fullPath = path.join(root, relativePath);
    tried.push(fullPath);
    if (fs.existsSync(fullPath)) {
      return import(pathToFileURL(fullPath).href);
    }
  }
  throw new Error(`Could not find Pi module ${relativePath}. Tried:\n${tried.join("\n")}`);
}

function sumUsage(messages) {
  const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 };
  for (const message of messages) {
    if (message.role !== "assistant" || !message.usage) continue;
    total.input += message.usage.input || 0;
    total.output += message.usage.output || 0;
    total.cacheRead += message.usage.cacheRead || 0;
    total.cacheWrite += message.usage.cacheWrite || 0;
    total.totalTokens += message.usage.totalTokens || 0;
  }
  return total;
}

function format(value) {
  if (value === null || value === undefined) return "unknown";
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

const sessionFile = resolveSessionFile(explicitSession);
const [{ parseSessionEntries, buildSessionContext }, { estimateContextTokens }] = await Promise.all([
  importPiModule("dist/core/session-manager.js"),
  importPiModule("dist/core/compaction/compaction.js")
]);

const fileEntries = parseSessionEntries(fs.readFileSync(sessionFile, "utf8"));
const header = fileEntries.find((entry) => entry.type === "session");
const entries = fileEntries.filter((entry) => entry.type !== "session");
const context = buildSessionContext(entries);
const estimate = estimateContextTokens(context.messages);
const totals = sumUsage(context.messages);
const assistantMessages = context.messages.filter((message) => message.role === "assistant");
const lastAssistant = assistantMessages.at(-1);
const lastUsage = lastAssistant?.usage || null;

const result = {
  sessionId: header?.id || null,
  sessionFile,
  cwd: header?.cwd || null,
  model: context.model,
  thinkingLevel: context.thinkingLevel,
  entries: entries.length,
  contextMessages: context.messages.length,
  assistantMessages: assistantMessages.length,
  activeContext: {
    estimatedTokens: estimate.tokens,
    usageTokensBase: estimate.usageTokens,
    trailingEstimatedTokens: estimate.tokens - estimate.usageTokens
  },
  lastAssistantUsage: lastUsage
    ? {
        input: lastUsage.input,
        output: lastUsage.output,
        cacheRead: lastUsage.cacheRead,
        cacheWrite: lastUsage.cacheWrite,
        totalTokens: lastUsage.totalTokens
      }
    : null,
  accumulatedAssistantUsage: totals
};

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Pi context usage`);
  console.log(`Session: ${result.sessionId || "unknown"}`);
  console.log(`File: ${sessionFile}`);
  console.log(`Model: ${result.model ? `${result.model.provider}/${result.model.modelId}` : "unknown"}`);
  console.log(`Thinking: ${result.thinkingLevel}`);
  console.log("");
  console.log(`Active context`);
  console.log(`- Estimated tokens: ${format(result.activeContext.estimatedTokens)}`);
  console.log(`- Usage-token base: ${format(result.activeContext.usageTokensBase)}`);
  console.log(`- Trailing estimate: ${format(result.activeContext.trailingEstimatedTokens)}`);
  console.log(`- Context messages: ${format(result.contextMessages)}`);
  console.log("");
  console.log(`Last assistant usage`);
  if (result.lastAssistantUsage) {
    console.log(`- Input: ${format(result.lastAssistantUsage.input)}`);
    console.log(`- Output: ${format(result.lastAssistantUsage.output)}`);
    console.log(`- Cache read: ${format(result.lastAssistantUsage.cacheRead)}`);
    console.log(`- Cache write: ${format(result.lastAssistantUsage.cacheWrite)}`);
    console.log(`- Total: ${format(result.lastAssistantUsage.totalTokens)}`);
  } else {
    console.log(`- unknown`);
  }
  console.log("");
  console.log(`Accumulated assistant usage, not active context`);
  console.log(`- Input: ${format(result.accumulatedAssistantUsage.input)}`);
  console.log(`- Output: ${format(result.accumulatedAssistantUsage.output)}`);
  console.log(`- Cache read: ${format(result.accumulatedAssistantUsage.cacheRead)}`);
  console.log(`- Cache write: ${format(result.accumulatedAssistantUsage.cacheWrite)}`);
  console.log(`- Total: ${format(result.accumulatedAssistantUsage.totalTokens)}`);
}
