async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(raw || "{}");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const apiKey = process.env.BIGMODEL_API_KEY || process.env.ZHIPUAI_API_KEY || "";
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Missing BIGMODEL_API_KEY" }));
  }

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Invalid JSON" }));
  }

  const text = typeof payload.text === "string" ? payload.text : "";
  if (!text) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Missing text" }));
  }

  const baseUrl = process.env.BIGMODEL_BASE_URL || "https://open.bigmodel.cn";
  const voice = typeof payload.voice === "string" ? payload.voice : process.env.BIGMODEL_TTS_VOICE || "tongtong";
  const speed = Number(payload.speed ?? process.env.BIGMODEL_TTS_SPEED ?? 1.0);
  const volume = Number(payload.volume ?? process.env.BIGMODEL_TTS_VOLUME ?? 1.0);

  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/paas/v4/audio/speech`;
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

  if (!upstream.ok) {
    const details = await upstream.text().catch(() => "");
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "glm-tts failed", status: upstream.status, details }));
  }

  const arrayBuf = await upstream.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Cache-Control", "no-store");
  res.end(buf);
};
