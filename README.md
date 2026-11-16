# ReelMind — Autonomous AI Video Studio

**Tagline:** *Your Entire Media Library. One Intelligent Creative Studio.*

Built on the **MERN Stack (MongoDB, Express, React, Node.js + TypeScript)** for the **UGREEN AI NAS Hackathon 2026 ("Unleash Your Creativity")**.

---

## Key Capabilities
- **Natural-Language Semantic Video Search:** Hybrid dense vector cosine similarity + lexical + transcript search with explainable match scores and source timestamps.
- **AI Creative Director & Storyboard Generator:** Ranks candidate clips across semantic relevance, technical quality, resolution, audio suitability, and diversity with dynamic weight renormalization, outputting strict Zod-validated storyboards.
- **Interactive Storyboard Studio:** Drag-and-drop scene ordering, bounded trim in/out editing, live aspect ratio switching (`16:9`, `9:16`, `1:1`, `4:5`), single-scene AI regeneration, undo/redo, autosave, and JSON / CMX3600 EDL export.
- **AI Content Studio:** Platform-tailored titles, hooks, captions, SEO descriptions, hashtags, thumbnail text, and scene narration grounded in selected footage.
- **Asynchronous Media Processing & Quality Center:** Non-blocking job queue with Socket.IO live progress, SHA-256 & perceptual duplicate audit, low-res detection, and manual job retries.
- **UGREEN AI NAS & Uliya Skill Package:** Read-only `UgreenNasAdapter` with AES-256-GCM encrypted credentials and a competition-compliant `skills/reelmind-studio/SKILL.md` package.

---

## Project Structure

```text
ReelMind/
├── client/                  # React 18 + Vite + TypeScript + Tailwind + Redux + TanStack Query
├── server/                  # Express + TypeScript + Mongoose + Socket.IO + Async Worker Queue
├── shared/                  # Shared TypeScript interfaces & Zod validation schemas
├── skills/reelmind-studio/  # Official UGREEN Uliya Skill package (SKILL.md + references/)
├── scripts/                 # UGREEN Skill package validator & ZIP packager
├── docs/                    # Architecture, API reference, and Hackathon proposal
├── Dockerfile               # Backend + FFmpeg worker Docker image
└── docker-compose.yml       # Local full-stack orchestration (MongoDB + Server + Client)
```

---

## Local Development Setup

### Prerequisites
- Node.js `v20+` (verified on `v22.23.4`)
- MongoDB `v7.0+` running locally (or MongoDB Atlas URI)
- Optional: `ffmpeg` & `ffprobe` on PATH for live video thumbnail & frame extraction

### 1. Configure Environment
```bash
cp .env.example .env
```
Update `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY` (64 hex chars). Optionally configure `AI_PROVIDER` (`gemini`, `openai`, `anthropic`, `ollama`, or `none` for deterministic offline engine).

### 2. Install & Build Workspaces
```bash
npm install
npm run build
```

### 3. Optional: Seed Demo Account & 150-Clip Demo Dataset
```bash
npm run seed
```
This creates `creator@reelmind.ai` / `ReelMind2026!`, seeds 150 clearly labeled `DEMO DATA` items (100 videos + 50 images), and builds 3 signature storyboards. You can also load the 150 demo assets directly from the UI inside any newly registered account.

### 4. Start Development Servers
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001/api/v1`

---

## Running Tests & Packaging UGREEN Skill

```bash
# Run full backend + frontend automated tests
npm test

# Validate & package UGREEN Uliya Skill ZIP -> dist/reelmind-studio-ugreen-skill.zip
npm run package:skill
```

---

## Production Vercel Deployment

ReelMind is configured for instant full-stack deployment on **Vercel** with both frontend React SPA and backend Express API served from a single unified domain with zero CORS setup:

- **Quick Deploy:** Connect your GitHub repository to Vercel and set `MONGODB_URI` in Project Settings.
- **Detailed Step-by-Step Guide:** [docs/VERCEL_DEPLOYMENT_GUIDE.md](docs/VERCEL_DEPLOYMENT_GUIDE.md)

### Local Docker Stack (Development / Staging)
```bash
docker compose up --build
```
Starts MongoDB, Express API (`:5001`), and Client (`:5173`).

---

## Documentation
- [Vercel Deployment Guide](docs/VERCEL_DEPLOYMENT_GUIDE.md)
- [Architecture & Multi-Agent Design](docs/ARCHITECTURE.md)
- [REST API Reference](docs/API.md)
- [Hackathon Project Proposal](docs/HACKATHON_PROPOSAL.md)
- [UGREEN Skill Specification](skills/reelmind-studio/SKILL.md)

