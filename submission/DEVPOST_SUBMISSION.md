# ReelMind — Devpost Project Submission

**Tagline:** Autonomous AI Video Creative Director & Semantic Media Intelligence for UGREEN AI NAS.  
**Track:** UGREEN AI NAS Hackathon  
**Skill Name:** `reelmind-studio`

---

## Inspiration

As video cameras, smartphones, and action cams push resolutions from 4K to 8K, creators, videographers, and families are accumulating terabytes of raw, unlabeled footage across personal Network Attached Storage (NAS) drives. 

The universal bottleneck in modern video creation isn't storage capacity—it is **content discovery and assembly**:
- Locating that specific three-second moment—such as a pet catching a frisbee at the beach or a child scoring a goal—demands tedious hours scrubbing through hundreds of scattered folders and obscure camera filenames like `DJI_0492.MP4`.
- Cloud-based AI video editors demand that users upload terabytes of raw video over consumer internet connections, incurring prohibitive bandwidth costs, long wait times, and serious privacy risks for private family moments and confidential client footage.
- Conversational AI chatbots lack direct filesystem access, hallucinating non-existent file paths and invalid out-of-bounds cut timestamps.

> **Our Core Question:** What if your private UGREEN AI NAS could act as your autonomous Creative Director—discovering exact scenes with verifiable evidence, ranking candidate shots with mathematical precision, and assembling continuous timelines without modifying your original files?

That vision inspired **ReelMind**—an intelligent, on-premises creative studio bridging natural-language understanding with raw media files on UGREEN AI NAS.

---

## What it does

**ReelMind** turns private UGREEN AI NAS media storage into an end-to-end autonomous video creative studio:

### 1. Semantic Natural-Language Scene Search
Users query their archive using everyday natural language (e.g., *"Find every clip of someone riding a bicycle near the beach at sunset"*). ReelMind analyzes visual scene descriptions, spoken audio transcripts, and technical stream metadata to find exact moments.

### 2. Explainable Multi-Factor Clip Ranking
Candidate clips are evaluated across six orthogonal quality dimensions. Every returned match displays an explainable score breakdown and explicit evidence attribution (`visual_analysis`, `transcript`, `metadata`, or `hybrid`).

### 3. Strict Timestamp-Bounded Storyboard Assembly
ReelMind generates contiguous, gapless timelines conforming to target duration (15s, 30s, 60s) and frame geometry (`16:9`, `9:16`, `1:1`, `4:5`). Transitions and captions are enforced by strict schema invariants.

### 4. Interactive Timeline Studio
Directors can preview cuts in an in-browser player, lock favorite shots, swap alternate scenes, adjust timecode windows, and re-order scenes via drag-and-drop.

### 5. Hollywood NLE Export
Exports both structured JSON production plans and industry-standard **CMX 3600 EDL** (Edit Decision List) files directly into DaVinci Resolve, Adobe Premiere Pro, and Final Cut Pro.

### 6. Grounded Content Studio
Automatically drafts platform-optimized publishing packages (titles, descriptions, viral hooks, hashtags, and voiceover scripts) grounded directly in the selected scenes.

### 7. Non-Destructive Storage Safety & Quality Audit
Runs SHA-256 and perceptual hash audits to identify reclaimable duplicate storage and low-resolution sub-HD clips without modifying or deleting original NAS media.

---

## How we built it

ReelMind separates lightweight NAS orchestration from heavy media intelligence using a two-tier architecture:

```
┌────────────────────────────────────────────────────────┐
│             UGREEN AI NAS (UGOS / Uliya)               │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │   reelmind-studio     │   │   UGOS Storage Pool  │  │
│  │   Uliya Markdown      │◄─►│   (Read-Only ACLs)   │  │
│  │   Skill Package       │   │   Raw Video/Photo/Audio  │  │
│  └──────────┬────────────┘   └──────────────────────┘  │
└─────────────┼──────────────────────────────────────────┘
              │ Authenticated REST / Socket.IO
┌─────────────▼──────────────────────────────────────────┐
│              ReelMind Companion Studio Server           │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Multi-Agent Pipeline: Intent → Search → Ranking   │  │
│  │ → Storyboard Generator → Zod Invariant Validator  │  │
│  └─────────────────────────┬─────────────────────────┘  │
│  ┌─────────────────────────▼─────────────────────────┐  │
│  │ MongoDB Archive Index • AES-256-GCM Vault • FFprobe│  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ React 18 + Vite + Tailwind Responsive UI Studio   │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 1. Uliya Skill Standard Implementation
The package under `skills/reelmind-studio` is strictly compliant with the Uliya Skill Standard:
- **`SKILL.md`**: Entry point declaring user goals, required inputs, whitelisted read-only CLI capabilities, five-stage orchestration, and completion/failure handling.
- **`references/`**: Modular Markdown references covering companion API endpoints, Zod storyboard schemas, UGOS compliance boundaries, and open-source license disclosures.
- **Pure Markdown**: The package is **9.6 KB**, containing zero binaries, zero executable scripts, and zero real credentials.

### 2. Multi-Agent Orchestration & Mathematical Ranking

ReelMind orchestrates six specialized expert agents:

1. **Intent Understanding Agent**: Parses creative prompts into visual subjects, pacing cues, target duration \\(T_{\text{target}}\\), and aspect ratio.
2. **Authorized Media Discovery Agent**: Traverses user-granted UGOS shared paths under read-only ACLs, extracting technical stream metadata via FFprobe without altering storage files.
3. **Hybrid Semantic Search Engine**: Evaluates hybrid vector cosine distance and lexical keyword/transcript match scores:

$$
S_{\text{hybrid}}(q, c) = \alpha \cdot \cos(\vec{v}_q, \vec{v}_c) + (1 - \alpha) \cdot S_{\text{lexical}}(q, c)
$$

where the vector cosine similarity between query embedding \\(\vec{v}_q\\) and clip embedding \\(\vec{v}_c\\) is defined as:

$$
\cos(\vec{v}_q, \vec{v}_c) = \frac{\vec{v}_q \cdot \vec{v}_c}{\|\vec{v}_q\|_2 \times \|\vec{v}_c\|_2}
$$

4. **Multi-Factor ClipRankingAgent**: Dynamically normalizes weights across six orthogonal criteria:

$$
R(c) = \sum_{i=1}^{6} w_i \cdot s_i(c) \quad \text{subject to} \quad \sum_{i=1}^{6} w_i = 1
$$

| Metric | Weight \\(w_i\\) | Description |
| :--- | :--- | :--- |
| **Semantic Relevance** | \\(w_1 = 0.35\\) | Hybrid cosine similarity to intent vector |
| **Visual Quality** | \\(w_2 = 0.20\\) | Exposure, stability, and aesthetic score |
| **Narrative Value** | \\(w_3 = 0.15\\) | Action prominence and emotional storytelling arc |
| **Resolution Quality** | \\(w_4 = 0.10\\) | Pixel geometry (4K UHD vs. 1080p HD vs. Sub-HD) |
| **Audio Suitability** | \\(w_5 = 0.10\\) | Speech clarity, transcript confidence, background noise |
| **Shot Diversity** | \\(w_6 = 0.10\\) | Penalty for visual redundancy across selected clips |

5. **Storyboard Generation & Validation Agent**: Enforces strict mathematical invariants on every sequence:

$$
0 \le t_{\text{start}}^{(i)} < t_{\text{end}}^{(i)} \le D_{\text{source}}^{(i)}
$$

$$
\text{Timeline continuity: } T_{\text{start}}^{(i)} = T_{\text{end}}^{(i-1)}, \quad \sum_{i=0}^{N-1} (t_{\text{end}}^{(i)} - t_{\text{start}}^{(i)}) = T_{\text{actual}} \approx T_{\text{target}}
$$

6. **Content Publishing Agent**: Formats social distribution kits tailored for YouTube Shorts, Instagram Reels, and TikTok.

### 3. Full-Stack MERN Studio
- **Backend**: Node.js, Express, TypeScript, MongoDB (via Mongoose), Socket.IO live indexing gateway, and Zod runtime schema validation.
- **Frontend**: React 18, Vite, Tailwind CSS, Redux Toolkit, and TanStack React Query, featuring an adaptive dark/light design system responsive across mobile, tablet, and desktop viewports.

---

## Challenges we ran into

- **Eliminating AI Hallucinations in Video Editing**: Standard LLMs frequently invent non-existent file paths or out-of-bounds timestamps (e.g., specifying a cut at second 45 in a 12-second clip). We resolved this by building a deterministic **Zod schema gatekeeper**. If an AI proposes an out-of-bounds cut, the validator automatically clamps timestamps to verified FFprobe stream bounds:

$$
0 \le t_{\text{start}} < t_{\text{end}} \le D_{\text{source}}
$$

- **Strict Read-Only NAS Safety**: In early iterations, we considered generating proxy preview files directly on the NAS storage pool. However, modifying user storage violated strict UGOS safety guardrails. We redesigned ReelMind to store all hashes, scene embeddings, and thumbnails strictly in the external application cache, guaranteeing zero writes to user NAS drives.
- **Hybrid AI Provider Architecture & Air-Gapped Fallback**: Ensuring the system runs anywhere—from an offline NAS using local Ollama LLMs to cloud deployments using Google Gemini or OpenAI—required engineering an abstract `AIProviderAdapter` with automated fallback to deterministic TF-IDF embeddings and AES-256-GCM encryption for stored API keys.
- **Hollywood NLE Timecode Synchronization**: Formatting CMX 3600 Edit Decision Lists (EDLs) required precise frame-accurate timecode calculations across standard 24, 25, and 30 fps rates to ensure exported sequences open seamlessly in DaVinci Resolve without frame drifting:

$$
\text{Timecode} = \text{HH:MM:SS:FF} \quad \text{where} \quad \text{FF} = \lfloor (t \pmod 1) \times \text{FPS} \rfloor
$$

---

## Accomplishments that we're proud of

- [x] **Verified Zero-Hallucination Timelines**: 100% of generated storyboards strictly satisfy temporal continuity and source duration invariants.
- [x] **Standard-Compliant Uliya Skill Package**: A pure-Markdown Skill package (**9.6 KB**) containing zero binary dependencies, passing all automated Uliya development standard checks.
- [x] **Universal Multi-Device Responsiveness**: The entire ReelMind Studio—from the media library and search studio to the interactive storyboard timeline and quality auditor—adapts seamlessly across extra-small mobile screens (320px), tablets (768px), and 4K desktop displays.
- [x] **Direct CMX 3600 EDL Export**: Bridge from autonomous NAS AI discovery into industry-standard editing suites with one click.
- [x] **Robust Automated Test Suite**: 10 comprehensive component and integration tests verifying studio state, store dispatching, and director controls with zero regressions.

---

## What we learned

- **Sandboxed Agent Orchestration**: Restricting agents to explicit read-only CLI boundaries (`ls`, `find`, `stat`, `ffprobe`) yields far more robust and trustworthy autonomous behaviors than granting open shell execution.
- **Dynamic Weight Renormalization**: In real-world media libraries, not every clip contains speech transcripts or 4K flags. Dynamically renormalizing weight vectors \\(w_i\\) across available signals prevents ranking degradation.
- **NAS-Centric AI Value**: Bringing AI intelligence to where private data physically lives is vastly superior in speed, privacy, and cost compared to uploading massive video archives to the cloud.

---

## What's next for ReelMind

- **Native UGOS App Center Package**: Packaging the companion server into an official one-click `.ugpk` installer for the UGREEN App Center.
- **Embedded Whisper ASR Container**: Integrating lightweight local Whisper speech recognition to transcribe spoken dialogue entirely on-device without cloud API calls.
- **Direct Hardware-Accelerated Rendering**: Leveraging NAS GPU/NPU hardware acceleration (Intel QuickSync / VAAPI) to render multi-track MP4 masters directly on the NAS.
- **Multi-Cam Face & Action Sync**: Auto-clustering multi-camera footage from family events or weddings by detected faces and acoustic sync markers.
