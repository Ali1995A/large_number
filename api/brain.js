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

  const baseUrl = process.env.BIGMODEL_BASE_URL || "https://open.bigmodel.cn";
  const model = process.env.BIGMODEL_TEXT_MODEL || "glm-4.7";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/paas/v4/chat/completions`;

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ transcript, state }) },
      ],
    }),
  });

  if (!upstream.ok) {
    const details = await upstream.text().catch(() => "");
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "glm-4.7 failed", status: upstream.status, details }));
  }

  const data = await upstream.json();
  const content = data?.choices?.[0]?.message?.content;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (typeof content !== "string") {
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: "Bad glm-4.7 response" }));
  }

  try {
    res.statusCode = 200;
    return res.end(JSON.stringify(JSON.parse(content)));
  } catch {
    res.statusCode = 200;
    return res.end(JSON.stringify({ sayText: content, actions: [{ type: "sparkle" }] }));
  }
};
