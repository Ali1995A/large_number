async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(raw || "{}");
}

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const apiKey = process.env.BIGMODEL_API_KEY || process.env.ZHIPUAI_API_KEY || "";
  if (!apiKey) return sendJson(res, 500, { error: "Missing BIGMODEL_API_KEY" });

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }

  const wavBase64 = typeof payload.wav_base64 === "string" ? payload.wav_base64 : "";
  if (!wavBase64) return sendJson(res, 400, { error: "Missing wav_base64" });

  const model = typeof payload.model === "string" ? payload.model : "glm-asr-2512";
  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  const hotwords = Array.isArray(payload.hotwords) ? payload.hotwords : null;

  const wavBuf = Buffer.from(wavBase64, "base64");
  if (!wavBuf.length) return sendJson(res, 400, { error: "Empty audio" });

  const baseUrl = process.env.BIGMODEL_BASE_URL || "https://open.bigmodel.cn";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/paas/v4/audio/transcriptions`;

  const form = new FormData();
  form.append("model", model);
  form.append("stream", "false");
  if (prompt) form.append("prompt", prompt);
  if (hotwords) form.append("hotwords", JSON.stringify(hotwords));

  const blob = new Blob([wavBuf], { type: "audio/wav" });
  form.append("file", blob, "audio.wav");

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!upstream.ok) {
    const details = await upstream.text().catch(() => "");
    return sendJson(res, 502, { error: "glm-asr failed", status: upstream.status, details });
  }

  const data = await upstream.json();
  return sendJson(res, 200, data);
};

