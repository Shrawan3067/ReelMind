# Third-Party Components, Sources, Licenses & Hackathon Disclosures

## 1. Principal Functionality Newly Developed for This Hackathon
The following core functionality and Skill workflows were newly authored for the **UGREEN AI NAS Hackathon**:
- **Uliya Creative Director Skill Specification (`reelmind-studio`)**: Pure-Markdown orchestration specification covering Intent Understanding, Authorized NAS Media Discovery, Hybrid Evidence-Attributed Scene Search, Multi-Factor Clip Ranking, Zod-Validated Storyboard Assembly, and Publishing Kit generation.
- **Multi-Agent Backend Pipeline (`@reelmind/server` + `@reelmind/shared`)**: TypeScript Express REST API, Socket.IO progress gateway, asynchronous media indexing & retry queue, hybrid semantic cosine + lexical + transcript retrieval, dynamic-renormalization ClipRankingAgent, StoryboardService with strict bounded-timestamp validation, CMX 3600 EDL exporter, SHA-256 duplicate auditor, AES-256-GCM secret vault, and read-only `UgreenNasAdapter`.
- **Interactive Web Studio (`@reelmind/client`)**: React 18 + Tailwind responsive Dark/Light studio UI (`Dashboard`, `Media Library`, `AI Search Studio`, `Storyboard Timeline Editor`, `Content Studio`, `Processing Center`, `Settings`).

## 2. AI Tools Used & Principal Uses
- **Runtime User-Configurable AI Providers (inside ReelMind `AIProviderAdapter`)**:
  - **UGREEN Uliya AI Assistant**: Natural-language entry point on UGOS for Skill routing and read-only local context orchestration.
  - **Optional External/Local LLMs & Embeddings (`Google Gemini`, `OpenAI`, `Anthropic`, `Ollama`, or `Deterministic Local Fallback`)**: Used strictly on authorized user media metadata, extracted frames, or transcripts to parse prompts, compute semantic embeddings, caption/describe scenes, rank matches, and draft social publishing packs.
- **AI Development Tools Used During Hackathon Engineering**:
  - **Antigravity / LLM Coding Assistants**: Used by the team during Hackathon development for TypeScript/React code scaffolding, UI/CSS refactoring, unit/component test authoring, and Markdown documentation review. All architecture decisions, UGREEN standard compliance checks, builds, and final code verification were performed and reviewed by the team.

## 3. Third-Party Open-Source Libraries & External Dependencies
| Component | Source / Upstream | License | Principal Role |
| :--- | :--- | :--- | :--- |
| Node.js Runtime | https://nodejs.org | MIT | JavaScript server runtime (companion server) |
| React & React DOM | https://github.com/facebook/react | MIT | Declarative UI rendering (`@reelmind/client`) |
| Vite & `@vitejs/plugin-react` | https://github.com/vitejs/vite | MIT | Frontend module bundler & dev server |
| TypeScript | https://github.com/microsoft/TypeScript | Apache-2.0 | Static type checking across workspaces |
| Tailwind CSS / PostCSS / Autoprefixer | https://github.com/tailwindlabs/tailwindcss | MIT | Responsive styling & Dark/Light theme tokens |
| Redux Toolkit & React Redux | https://github.com/reduxjs/redux-toolkit | MIT | Client auth, selection & theme state |
| TanStack React Query | https://github.com/TanStack/query | MIT | Server state caching & mutations |
| React Router DOM | https://github.com/remix-run/react-router | MIT | Client routing & protected views |
| React Hook Form & Hookform Resolvers | https://github.com/react-hook-form/react-hook-form | MIT | Auth & Settings form validation |
| Lucide React | https://github.com/lucide-team/lucide | ISC | UI iconography |
| Recharts | https://github.com/recharts/recharts | MIT | Dashboard analytics charts |
| Axios | https://github.com/axios/axios | MIT | Companion HTTP client with token refresh |
| Express.js | https://github.com/expressjs/express | MIT | REST API routing (companion server) |
| Mongoose | https://github.com/Automattic/mongoose | MIT | MongoDB ODM schema modeling |
| MongoDB Community (external runtime) | https://www.mongodb.com/try/download/community | SSPL-1.0 | Persistent media, scene & storyboard store |
| Socket.IO & Socket.IO Client | https://github.com/socketio/socket.io | MIT | Real-time processing progress events |
| Zod | https://github.com/colinhacks/zod | MIT | Strict schema & storyboard bounds validation |
| Pino & Pino Pretty | https://github.com/pinojs/pino | MIT | Structured JSON server logging |
| Multer | https://github.com/expressjs/multer | MIT | Authorized multipart local media uploads |
| bcryptjs | https://github.com/dcodeIO/bcrypt.js | MIT | Password hashing |
| jsonwebtoken | https://github.com/auth0/node-jsonwebtoken | MIT | JWT access & refresh rotation |
| Helmet / CORS / Cookie-Parser / Express-Rate-Limit / Dotenv / UUID | npm / ExpressJS & OpenJS ecosystem | MIT / BSD-2-Clause | Security headers, CORS, rate limiting & env config |
| FFmpeg / FFprobe *(optional host CLI)* | https://ffmpeg.org | LGPL-2.1+ / GPL-2.0+ | Optional host video/audio metadata & thumbnail extraction |
| Vitest / Testing Library / JSDOM / Supertest / Playwright *(dev/test only)* | Vitest, Testing Library, Microsoft Playwright | MIT / Apache-2.0 | Automated unit, component, API & E2E verification |

