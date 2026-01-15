# 糖果公主：最大的数字

给幼儿园小朋友玩的离线网页小应用（iPad 友好）：用“糖果+公主王国”的方式直观感受 **万 / 亿 / 万亿** 的数量级。

## 使用

### 本地跑起来（推荐：支持后端 env、TTS、Realtime relay）

1. 复制环境变量文件：把 `.env.example` 复制为 `.env` 并填入 `BIGMODEL_API_KEY`
2. 安装依赖：`npm i`
3. 启动：`npm run dev`，打开 `http://127.0.0.1:5173/`

## 部署到 Vercel

1. 直接把仓库导入 Vercel
2. 在 Vercel 项目环境变量里配置（建议三套都配：Development/Preview/Production）：
   - `BIGMODEL_API_KEY`（必填）
   - `BIGMODEL_BASE_URL`（可选，默认 `https://open.bigmodel.cn`）
   - `BIGMODEL_TEXT_MODEL`（可选，默认 `glm-4.7`）
   - `BIGMODEL_TTS_VOICE`（可选，默认 `tongtong`）
   - `BIGMODEL_TTS_SPEED`（可选，默认 `1.0`）
   - `BIGMODEL_TTS_VOLUME`（可选，默认 `1.0`）
3. 部署后：
   - `POST /api/tts`：服务端代发 `glm-tts`（前端 `config.js` 已默认用 `server-tts`）
   - `POST /api/brain`：服务端调用 `glm-4.7` 产出 `{sayText, actions}`
   - `POST /api/asr`：服务端调用 `glm-asr-2512`，把音频转文字

注意：Vercel Serverless 通常不支持 WebSocket relay，因此 `glm-realtime` 的 WS 代理需要单独部署（例如云主机/Render/Fly/Cloudflare Workers）。Vercel 这边负责静态页面 + `/api/brain` + `/api/tts` 即可。

### 纯静态打开（无需 Node）

也可以直接打开 `index.html`（部分浏览器在 `file://` 下对音频/缓存会有限制）。
3. 操作方式：
   - 左右滑动：换到更大/更小的数字
   - 点一下魔法棒：读出当前数字（中文）
   - 长按魔法棒：自动一路变大
   - 按住麦克风说话：提问；松开后识别并回答（`/api/asr` + `/api/brain` + `/api/tts`）
   - 双指捏合：缩放糖果画面

## 数字范围

从 `1万` 一直到 `1万亿`（阿拉伯数字 + 中文数字 + 读音）。

## 发音（两种方式）

### 方式 A（推荐）：预生成音频，离线最稳定

用 GLM-TTS 生成固定短句音频并放到 `audio/`，页面会优先播放本地音频（无需在网页里放 API Key）：

- 生成：`node tools/generate-audio.mjs --apiKey YOUR_KEY`
- 输出目录：`audio/*.wav`（文件名为数字值，例如 `audio/10000.wav`）

### 方式 B：网页直连 GLM-TTS（需要联网）

把 `config.js` 里的 `provider` 改成 `zhipu-glm-tts`，并填写 `apiKey`（注意：把 Key 放在前端有泄露风险，仅建议个人本地使用）：

- `config.js`

### 方式 C：后端代发 GLM-TTS（推荐）

在启用 `npm run dev` 的情况下，前端可以把 `config.js` 的 `provider` 改成 `server-tts`，这样 TTS 会调用本地 `POST /api/tts`，Key 只保存在 `.env`。
