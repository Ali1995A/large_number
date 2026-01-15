module.exports = function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      hasKey: Boolean(process.env.BIGMODEL_API_KEY || process.env.ZHIPUAI_API_KEY),
      textModel: process.env.BIGMODEL_TEXT_MODEL || "glm-4.7",
      asr: {
        provider: "server-asr",
        model: "glm-asr-2512"
      },
      tts: {
        provider: "server-tts",
        voice: process.env.BIGMODEL_TTS_VOICE || "tongtong",
        speed: Number(process.env.BIGMODEL_TTS_SPEED || 1.0),
        volume: Number(process.env.BIGMODEL_TTS_VOLUME || 1.0),
      },
      notes: [
        "Vercel Serverless 不支持 WebSocket relay；glm-realtime 需要单独部署 WS 代理，或使用其它可直连方式。",
      ],
    })
  );
};
