import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const LEVELS = [
  { value: 10, cn: "十" },
  { value: 100, cn: "一百" },
  { value: 1_000, cn: "一千" },
  { value: 10_000, cn: "一万" },
  { value: 100_000, cn: "十万" },
  { value: 1_000_000, cn: "一百万" },
  { value: 10_000_000, cn: "一千万" },
  { value: 100_000_000, cn: "一亿" },
  { value: 1_000_000_000, cn: "十亿" },
  { value: 10_000_000_000, cn: "一百亿" },
  { value: 100_000_000_000, cn: "一千亿" },
  { value: 1_000_000_000_000, cn: "一万亿" },
  { value: 10_000_000_000_000, cn: "十万亿" },
  { value: 100_000_000_000_000, cn: "一百万亿" },
  { value: 1_000_000_000_000_000, cn: "一千万亿" },
  { value: 10_000_000_000_000_000, cn: "一亿亿" },
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

const apiKey = arg("apiKey") || process.env.BIGMODEL_API_KEY || process.env.ZHIPUAI_API_KEY;
const baseUrl = arg("baseUrl") || "https://open.bigmodel.cn";
const voice = arg("voice") || "tongtong";
const speed = Number(arg("speed") || "1.0");
const volume = Number(arg("volume") || "1.0");
const outDir = resolve(arg("outDir") || "audio");

if (!apiKey) {
  console.error("Missing API key. Use --apiKey or env BIGMODEL_API_KEY/ZHIPUAI_API_KEY.");
  process.exit(2);
}

await mkdir(outDir, { recursive: true });

for (const L of LEVELS) {
  const text = `${L.cn}颗糖`;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/paas/v4/audio/speech`;
  const res = await fetch(endpoint, {
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

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`TTS failed for ${text}: ${res.status} ${res.statusText} ${errText}`.trim());
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const file = resolve(outDir, `${L.value}.wav`);
  await writeFile(file, buf);
  process.stdout.write(`OK ${text} -> ${file}\n`);
}
