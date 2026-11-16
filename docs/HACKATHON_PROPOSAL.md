# ReelMind Studio — Hackathon Project Proposal
**Skill Name:** `reelmind-studio` | **Track:** UGREEN AI NAS Hackathon

---

### 1. One sentence: What does the Skill do?
ReelMind turns authorized UGREEN AI NAS media libraries into natural-language scene search, ranked storyboards, and platform publishing kits without modifying originals.

### 2. Who is the target user and problem?
Independent creators, videographers, families, and media teams archive thousands of unlabeled clips across NAS drives. Locating exact brief moments—such as a pet jumping into a pool—requires scrubbing hours of scattered folders before editing can even begin.

### 3. What is your proposed solution?
ReelMind pairs an official Uliya Skill with a companion MERN studio (MongoDB, Express, React, Node.js). Natural-language requests trigger non-destructive NAS discovery, hybrid vector/lexical search, multi-factor clip ranking, strict timestamp-bounded storyboard assembly, interactive timeline refinement, and grounded social publishing copy generation.

### 4. What is the Core User Flow?
Creators connect an authorized read-only UGOS share, then submit a prompt with target duration and aspect ratio. ReelMind searches scenes, ranks matches with explainable scores, compiles an editable timeline exporting JSON or CMX 3600 EDL, and drafts platform-ready titles, captions, and narration.

### 5. What substantive difference does your idea offer compared with existing tools or conventional AI solutions?
Chatbots hallucinate filenames and timestamps, while cloud tools force uploading private terabytes. ReelMind operates NAS-first, isolates demo datasets, enforces bounded timestamps and contiguous timelines via Zod, attributes verifiable evidence (visual analysis, transcripts, metadata), and supports offline deterministic fallback.

### 6. Which UGREEN AI NAS capabilities will be used, and at which step in the workflow?
Steps 1–2 use Uliya natural-language intent parsing, UGOS shared-folder ACLs, and read-only storage discovery. Steps 3–5 utilize NAS Docker hosting and optional local Ollama LLMs for private semantic embeddings, scene metadata indexing, clip ranking explanations, and EDL/JSON export while keeping media securely on-premises.

### 7. What was your technical approach? Describe the planned Skill workflow, supported NAS CLI capabilities, expert agent orchestration, required inputs, permissions, AI model choices, and data handling, as applicable;
SKILL.md defines creative inputs (prompt, duration, aspect ratio, share path). Supported CLI capabilities remain strictly read-only: ls, find, stat, df, and ffprobe. Orchestration sequences six specialized agents (Intent, Discovery, Search, Ranking, Storyboard, Content). AI providers are runtime-swappable (Gemini, OpenAI, Anthropic, Ollama, local fallback). Keys are AES-256-GCM encrypted.

### 8. What is the current development status? Identify what was implemented already, not yet implemented, or is pending NAS validation if selected to be a Finalist.
Implemented: complete Uliya Skill package, full-stack MERN studio, async FFprobe metadata indexing, hybrid search, six-factor clip ranking, timeline editor, CMX 3600 EDL export, and Content Studio. Not yet implemented: native UGOS App Center package, bundled Whisper ASR, and server-side MP4 rendering. Pending Finalist validation: live UGOS ACL verification, terabyte stress tests, and local Ollama benchmarks.

### 9. What is your final validation plan? Name two core test cases and one edge case to validate if selected as a Finalist.
Core Case 1: Prompt "dog jumping into pool for 30s 16:9 reel" against 500 NAS clips verifies exact scene detection, contiguous timeline bounds, and CMX 3600 EDL export into DaVinci Resolve. Core Case 2: SHA-256 duplicate and quality audit across 1,000 raw files. Edge Case: Empty or offline NAS share reports unavailability honestly without fabricating clips.

### 10. Are there any known limitations of your Project? Describe current known limitations, technical risks, and any external dependencies.
Dependencies: Node.js/MongoDB companion server, optional FFprobe, and user AI keys (unless running local Ollama). Technical risks: hardware variance across NAS CPU/RAM tiers during indexing. Limitations: final multi-track video rendering relies on importing EDLs into an NLE, and heuristic fallback yields lower semantic recall than neural models.

---

## Third-Party Components & Licenses *(Excluded from 500-word limit)*
| Component | Source | License |
| :--- | :--- | :--- |
| React & React DOM | https://github.com/facebook/react | MIT |
| Vite & Tailwind CSS | https://github.com/vitejs/vite | tailwindcss.com | MIT |
| Redux Toolkit, TanStack Query, React Router, Axios | npm OpenJS / Remix / TanStack | MIT |
| Recharts, React Hook Form, Lucide React | npm / lucide.dev | MIT / ISC |
| TypeScript | https://github.com/microsoft/TypeScript | Apache-2.0 |
| Express.js, Mongoose, Socket.IO, Zod, Pino, Multer | npm OpenJS / colinhacks | MIT |
| bcryptjs, jsonwebtoken, Helmet, CORS, Express-Rate-Limit | npm ExpressJS ecosystem | MIT / BSD-2-Clause |
| MongoDB Community (external runtime) | https://www.mongodb.com/try/download/community | SSPL-1.0 |
| FFmpeg / FFprobe (optional external CLI) | https://ffmpeg.org | LGPL-2.1+ / GPL-2.0+ |
| Vitest, Testing Library, JSDOM, Supertest, Playwright (dev) | npm test ecosystem | MIT / Apache-2.0 |
| Optional AI Providers & Dev Coding Assistants | Google Gemini / OpenAI / Anthropic / Ollama / Antigravity | Commercial / MIT (Ollama) |

## Team Consent Declaration & Signatures *(Excluded from 500-word limit)*
We confirm that the submitted Skill workflow (`skills/reelmind-studio`) and core ReelMind architecture were newly developed during this Hackathon in compliance with official competition guidelines, privacy rules, and open-source licensing disclosures.

| Team Member Name | Role | Consent | Electronic Signature | Date |
| :--- | :--- | :--- | :--- | :--- |
| [Member 1 Full Name] | Architecture & Backend | Agreed | `/s/ [Member 1 Name]` | YYYY-MM-DD |
| [Member 2 Full Name] | Frontend & UX (optional) | Agreed | `/s/ [Member 2 Name]` | YYYY-MM-DD |
