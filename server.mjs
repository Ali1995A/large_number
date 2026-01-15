import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const ROOT = __dirname;

const PORT = Number(process.env.PORT || process.env.APP_PORT || 5173);
const HOST = process.env.HOST || process.env.APP_HOST || "127.0.0.1";

const BIGMODEL_API_KEY = process.env.BIGMODEL_API_KEY || process.env.ZHIPUAI_API_KEY || "";
const BIGMODEL_BASE_URL = process.env.BIGMODEL_BASE_URL || "https://open.bigmodel.cn";
const BIGMODEL_REALTIME_URL =
  process.env.BIGMODEL_REALTIME_URL || "wss://open.bigmodel.cn/api/paas/v4/realtime";
const BIGMODEL_TEXT_MODEL = process.env.BIGMODEL_TEXT_MODEL || "glm-4.7";

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".wav", "audio/wav"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
]);

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let path = decodeURIComponent(url.pathname);
  if (path === "/") path = "/index.html";
  if (path.includes("..")) return sendJson(res, 400, { error: "bad path" });
  const full = join(ROOT, path);
  try {
    const st = await stat(full);
    if (!st.isFile()) return sendJson(res, 404, { error: "not found" });
    const buf = await readFile(full);
    const ext = extname(full).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME.get(ext) || "application/octet-stream",
      "Cache-Control": ext === ".wav" ? "no-store" : "no-cache",
      "Content-Length": buf.length,
    });
    res.end(buf);
  } catch {
    sendJson(res, 404, { error: "not found" });
  }
}

async function handleBrain(req, res) {
  if (!BIGMODEL_API_KEY) return sendJson(res, 500, { error: "Missing BIGMODEL_API_KEY" });
  const raw = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf-8") || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }

  const transcript = typeof payload.transcript === "string" ? payload.transcript : "";
  const state = payload.state && typeof payload.state === "object" ? payload.state : {};

  const system = [
    "你是糖果公主的语音助手，面向5岁儿童。",
    "你的任务：根据孩子的问题，给出一句简短回答，并产出要驱动网页的动作。",
    "请只输出严格 JSON：{ \"sayText\": string, \"actions\": Action[] }。",
    "Action 只能是：",
    "- {\"type\":\"showLevel\",\"value\":number}  // value 只能是以下之一：10,100,1000,10000,100000,1000000,10000000,100000000,1000000000,10000000000,100000000000,1000000000000,10000000000000,100000000000000,1000000000000000,10000000000000000",
    "- {\"type\":\"sparkle\"}",
    "- {\"type\":\"setZoom\",\"value\":number} // 0.8..1.35",
    "不要输出多余字段，不要输出 Markdown。",
  ].join("\n");

  const body = {
    model: BIGMODEL_TEXT_MODEL,
    stream: false,
    temperature: 0.7,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({ transcript, state }),
      },
    ],
  };

  const endpoint = `${BIGMODEL_BASE_URL.replace(/\/$/, "")}/api/paas/v4/chat/completions`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BIGMODEL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return sendJson(res, 502, { error: "glm-4.7 request failed", status: resp.status, details: errText });
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return sendJson(res, 502, { error: "Bad glm-4.7 response" });

  try {
    const parsed = JSON.parse(content);
    return sendJson(res, 200, parsed);
  } catch {
    return sendJson(res, 200, { sayText: content, actions: [{ type: "sparkle" }] });
  }
}

async function handleTts(req, res) {
  if (!BIGMODEL_API_KEY) return sendJson(res, 500, { error: "Missing BIGMODEL_API_KEY" });
  const raw = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf-8") || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }

  const text = typeof payload.text === "string" ? payload.text : "";
  if (!text) return sendJson(res, 400, { error: "Missing text" });

  const voice = typeof payload.voice === "string" ? payload.voice : process.env.BIGMODEL_TTS_VOICE || "tongtong";
  const speed = Number(payload.speed ?? process.env.BIGMODEL_TTS_SPEED ?? 1.0);
  const volume = Number(payload.volume ?? process.env.BIGMODEL_TTS_VOLUME ?? 1.0);

  const endpoint = `${BIGMODEL_BASE_URL.replace(/\/$/, "")}/api/paas/v4/audio/speech`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BIGMODEL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "glm-tts",
      input: text,
      voice,
      response_format: "wav",
      speed,
      volume,
      stream: false,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return sendJson(res, 502, { error: "glm-tts request failed", status: resp.status, details: errText });
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  res.writeHead(200, {
    "Content-Type": "audio/wav",
    "Cache-Control": "no-store",
    "Content-Length": buf.length,
  });
  res.end(buf);
}

function createHttpServer() {
  return http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health") return sendJson(res, 200, { ok: true });

  if (url.pathname === "/api/config") {
    return sendJson(res, 200, {
      hasKey: Boolean(BIGMODEL_API_KEY),
      realtimeRelayUrl: "/api/realtime/relay",
      textModel: BIGMODEL_TEXT_MODEL,
      tts: {
        provider: "server-tts",
        voice: process.env.BIGMODEL_TTS_VOICE || "tongtong",
        speed: Number(process.env.BIGMODEL_TTS_SPEED || 1.0),
        volume: Number(process.env.BIGMODEL_TTS_VOLUME || 1.0),
      },
    });
  }

  if (url.pathname === "/api/brain" && req.method === "POST") return handleBrain(req, res);
  if (url.pathname === "/api/tts" && req.method === "POST") return handleTts(req, res);

  return serveStatic(req, res);
  });
}

function createRelay(server) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (clientWs) => {
  if (!BIGMODEL_API_KEY) {
    clientWs.close(1011, "Missing BIGMODEL_API_KEY");
    return;
  }

  const upstreamWs = new WebSocket(BIGMODEL_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${BIGMODEL_API_KEY}`,
    },
  });

  const closeBoth = (code, reason) => {
    try {
      clientWs.close(code, reason);
    } catch {}
    try {
      upstreamWs.close(code, reason);
    } catch {}
  };

  clientWs.on("message", (data) => {
    if (upstreamWs.readyState === WebSocket.OPEN) upstreamWs.send(data);
  });
  clientWs.on("close", () => closeBoth(1000, "client closed"));
  clientWs.on("error", () => closeBoth(1011, "client error"));

  upstreamWs.on("open", () => {
    // pass
  });
  upstreamWs.on("message", (data) => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
  });
  upstreamWs.on("close", () => closeBoth(1000, "upstream closed"));
  upstreamWs.on("error", () => closeBoth(1011, "upstream error"));
  });

  server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/api/realtime/relay") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  return wss;
}

export async function startServer({ host = HOST, port = PORT } = {}) {
  const server = createHttpServer();
  const wss = createRelay(server);

  await new Promise((resolveListen) => server.listen(port, host, resolveListen));
  // eslint-disable-next-line no-console
  console.log(`Dev server: http://${host}:${port}`);
  console.log(`Realtime relay: ws://${host}:${port}/api/realtime/relay`);

  return {
    server,
    wss,
    close: async () => {
      await Promise.allSettled([
        new Promise((r) => wss.close(() => r())),
        new Promise((r) => server.close(() => r())),
      ]);
    },
  };
}

if (import.meta.url === `file://${__filename}`) {
  startServer().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  });
}
