# ReelMind Studio — Architecture & Multi-Agent Overview

ReelMind separates lightweight NAS orchestration inside this Skill package from the containerized companion MERN media-intelligence server.

## 1. Architecture Split
- **UGREEN Uliya Skill (`SKILL.md` + `references/`)**: Pure Markdown specification invoked by Uliya on UGOS to parse natural-language creative requests, honor read-only UGOS share permissions, invoke permitted read-only NAS CLI tools, and coordinate structured storyboard plans. Contains zero compiled binaries, scripts, manifests, or embedded runtimes.
- **Companion MERN Studio Server (`<REELMIND_SERVER_URL>`)**: Standalone Express.js + TypeScript + MongoDB + Socket.IO application providing non-blocking FFprobe metadata probing, SHA-256 & sampled perceptual hashing, hybrid semantic/lexical search, Zod-validated storyboard generation, interactive timeline editing, and platform publishing copy generation.

## 2. Example Configuration Placeholders
Use placeholder environment values only when pairing the companion server with a NAS deployment:

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/reelmind
UGREEN_NAS_HOST=<NAS_HOST_OR_IP>
UGREEN_NAS_SHARE_PATH=<AUTHORIZED_UGOS_SHARE_PATH>
UGREEN_NAS_API_TOKEN=<UGOS_READONLY_TOKEN_PLACEHOLDER>
AI_PROVIDER=<gemini|openai|anthropic|ollama|none>
AI_API_KEY=<PROVIDER_API_KEY_PLACEHOLDER>
```

Never store real personal emails, live API keys, or NAS passwords inside Skill files.

