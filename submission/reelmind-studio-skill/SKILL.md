---
name: reelmind-studio
description: Autonomous AI video creative director and semantic media intelligence skill for UGREEN AI NAS (UGOS / Uliya). Discovers authorized NAS media, searches scenes via natural language, ranks clips, and assembles validated editing-ready storyboards without altering original NAS files.
---

# ReelMind Studio — UGREEN AI NAS Skill

## User Goal
Transform a private collection of videos, photos, and audio stored on a UGREEN AI NAS into an intelligent, searchable creative studio. Given a plain-language creative request (for example: *"Find every clip where the dog jumps into the swimming pool and create a 30-second cinematic video"*), this Skill coordinates Uliya's authorized read-only NAS media discovery and the companion ReelMind MERN server to surface matching clips, rank the strongest footage, assemble a timestamp-validated storyboard, and generate grounded social publishing assets without altering original NAS files.

## Required Inputs
Collect or confirm these inputs before running creative orchestration (placeholder formats shown; never embed real passwords, personal emails, or API keys):
1. **`creative_prompt`** *(string, required)*: Plain-language description of the target video story, visual subject, or action.
2. **`target_duration_seconds`** *(integer, optional, default: `30`, range: `5–300`)*: Target timeline duration in seconds.
3. **`aspect_ratio`** *(enum, optional, default: `16:9`)*: Target delivery aspect ratio (`16:9`, `9:16`, `1:1`, or `4:5`).
4. **`authorized_share_scope`** *(string, optional)*: UGOS shared directory granted read-only access (e.g., `/mnt/<VOLUME>/Media/<SHARE_FOLDER>`).
5. **`reelmind_server_url`** *(URL, optional)*: Companion ReelMind studio backend placeholder (e.g., `http://<NAS_HOST>:5001/api/v1`) authenticated via short-lived `<REELMIND_ACCESS_TOKEN>`.

## Supported NAS CLI Capabilities
When invoked on UGREEN AI NAS (UGOS / Uliya), only non-destructive, read-only CLI inspection and explicitly authorized companion API calls are permitted:
- **Read-Only Directory & File Inspection**: `ls`, `find` *(read-only traversal without `-delete` or `-exec`)*, and `stat` on `authorized_share_scope` to verify media filenames and sizes under UGOS ACLs.
- **Storage Health Check**: `df -h` to inspect mount availability without modifying volumes.
- **Host Media Metadata Probe *(optional)***: `ffprobe -v quiet -print_format json -show_format -show_streams "<AUTHORIZED_FILE>"` solely to inspect real container duration, codecs, and resolution.
- **Companion API Communication**: `curl` over HTTP/HTTPS strictly to user-configured `reelmind_server_url` endpoints defined in [Companion REST API Contract](references/api-contract.md).
- **Explicitly Prohibited CLI Actions**: Never execute `rm`, `mv`, `cp` overwrites, `chmod`, `chown`, `mkfs`, or credential-dump commands; never modify original NAS media files or invent undocumented UGOS endpoints.

## Expert Agent Orchestration Workflow

### Step 1 — Intent Understanding Agent
Extract structured creative parameters from `creative_prompt`:
- Visual action & subject keywords (e.g., `dog`, `jumping`, `swimming pool`)
- Target cut duration (`target_duration_seconds`) and frame geometry (`aspect_ratio`)
- Desired editorial mood, pacing, and narrative arc (opening -> buildup -> climax -> resolution)

### Step 2 — Authorized Media Discovery Agent
Verify permitted media sources in the active session before querying:
- Check UGOS mount/share reachability (`GET /nas/status`) or Uliya's authorized photo/video index in strict read-only mode.
- Never fabricate filenames, directory paths, or NAS connection status.
- If no NAS share is mounted or accessible, transparently inform the user and offer to run against ReelMind's isolated demonstration dataset (`isDemoData: true`).

### Step 3 — Hybrid Semantic Search & Evidence Attribution
Query indexed scenes across visual descriptions, detected tags/objects, audio transcripts, and probed media metadata (`POST /search/semantic`).
Every matched scene MUST attach:
- Verified `mediaAssetId`, `sourceFilename`, and `sourceType` (`ugreen_nas`, `local_upload`, or `demo`)
- Bounded source timestamps (`0 <= sourceStartTime < sourceEndTime <= sourceDuration`)
- Honest `evidenceSource` (`visual_analysis`, `transcript`, `metadata`, or `hybrid`) — never report pixel-level `visual_analysis` unless a vision-capable model inspected extracted frames.

### Step 4 — Smart Clip Selection & Multi-Factor Ranking Agent
Score candidate clips across available dimensions (dynamically renormalizing weights if any signal is unavailable):
- Semantic Relevance (`0.35`)
- Visual / Technical Quality (`0.20`)
- Narrative Value (`0.15`)
- Resolution Quality (`0.10`)
- Audio Suitability (`0.10`)
- Clip Diversity (`0.10`)

### Step 5 — Validated Storyboard Generator & Publishing Kit
Assemble the cut list strictly conforming to [Storyboard Schema & Validation](references/storyboard-schema.md):
- Zero-indexed scene sequence (`0..N-1`) with contiguous `timelineStartTime..timelineEndTime` (zero gaps or overlaps)
- Valid transitions (`cut`, `fade_in`, `fade_out`, `crossfade`, `dissolve`, `wipe`), captions, and audio cue notes
- Generate structured production exports (`JSON` or `CMX3600 EDL`) and grounded publishing packs (`POST /content/generate-pack`).

## Completion & Failure Handling
- **Success**: Return the verified storyboard timeline summary, source filenames, bounded timestamps, ranking explanations, evidence tags, and export readiness (`JSON` / `CMX3600 EDL`).
- **Zero or Partial Matches**: Report the exact matched count honestly (`0` or partial), explain why coverage fell short, and guide the user to verify UGOS share permissions or queue indexing in ReelMind Processing Center. Never invent placeholder clips or synthetic timestamps.
- **NAS Offline or Permission Denied**: Report exact unmounted/unauthorized status and halt NAS traversal without attempting permission bypasses; optionally allow isolated demo preview if requested.
- **Offline AI Mode**: Automatically fall back to local TF-IDF / lexical embeddings (`AI_PROVIDER=none`) or local Ollama models with clear capability attribution.
- **Destructive Action Guardrail**: Refuse automatic file deletions on NAS volumes; allow manual index removal only inside the authenticated web UI.

## Linked Supporting References
Every Markdown file packaged alongside `SKILL.md`:
- [Architecture & Data Flow Overview](references/architecture-overview.md)
- [Companion REST API Contract](references/api-contract.md)
- [Storyboard Schema & Validation](references/storyboard-schema.md)
- [UGOS Compliance & Safety Boundaries](references/ugos-compliance.md)
- [Third-Party Components, Sources, Licenses & AI Disclosures](references/third-party-disclosures.md)

## Hackathon Disclosures Summary
- **Principal Newly Developed Functionality**: Multi-agent creative director Skill workflow, hybrid semantic vector/lexical/transcript search, dynamic clip ranking engine, Zod-validated storyboard & CMX3600 EDL pipeline, Content Studio pack generator, duplicate/quality auditor, encrypted secret vault, read-only `UgreenNasAdapter`, and full responsive React + TypeScript Dark/Light web UI.
- **AI Tools Used & Principal Uses**: Runtime configurable providers (`Google Gemini`, `OpenAI`, `Anthropic`, `Ollama`, or deterministic local engine) plus Uliya orchestration for prompt parsing, embeddings, frame analysis, ranking rationale, and publishing copy; LLM coding assistants used during Hackathon engineering for scaffolding, refactoring, test writing, and doc review (verified by the team).
- **Third-Party Libraries**: Full component names, upstream sources, and licenses (React, Vite, Tailwind, Express, Mongoose, MongoDB, Socket.IO, Zod, Pino, Multer, FFmpeg/FFprobe, etc.) are documented in [Third-Party Disclosures](references/third-party-disclosures.md).
