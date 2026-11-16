# ReelMind REST API Reference (`/api/v1`)

All protected endpoints accept `Authorization: Bearer <accessToken>` or HTTP-only `reelmind_access_token` cookies.

## Health Check
- `GET /api/v1/health` — Returns API status and timestamp.

## Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register account `{ name, email, password }`.
- `POST /api/v1/auth/login` — Sign in `{ email, password }`.
- `POST /api/v1/auth/refresh` — Rotate refresh token (`reelmind_refresh_token` cookie or body `{ refreshToken }`).
- `POST /api/v1/auth/logout` — Revoke active refresh session and clear cookies.
- `GET /api/v1/auth/me` — Fetch authenticated profile (secrets redacted).
- `PATCH /api/v1/auth/me` — Update display name, theme/aspect preferences, and encrypted AI provider config.
- `GET /api/v1/auth/sessions` — List active refresh sessions for the authenticated user.
- `DELETE /api/v1/auth/sessions/:sessionId` — Revoke an active refresh session.

## Dashboard (`/api/v1/dashboard`)
- `GET /api/v1/dashboard/stats` — Media totals, storage bytes, scenes indexed, job counts, NAS status, recent searches.
- `GET /api/v1/dashboard/recent-projects` — Recent storyboard projects.

## Media Library (`/api/v1/media`)
- `GET /api/v1/media` — Paginated & cursor-paginated list (`page`, `cursor`, `limit`, `mediaType`, `sourceType`, `search`, `minDuration`, `maxDuration`, `minWidth`, `favorite`, `collection`, `sortBy`, `sortOrder`; returns `pagination.nextCursor`).
- `POST /api/v1/media/upload` — Multipart upload (`files`, max 10 files, MIME & size validated), enqueues async processing.
- `GET /api/v1/media/:id` — Asset metadata and indexed scenes.
- `DELETE /api/v1/media/:id?confirm=true` — Deletes index record (and local upload if applicable; never deletes original NAS files).
- `POST /api/v1/media/:id/analyze` — Enqueues background analysis job.
- `GET /api/v1/media/:id/scenes` — Lists indexed scenes for asset.
- `PATCH /api/v1/media/:id/favorite` — Toggles favorite status.
- `PATCH /api/v1/media/:id/collections` — Updates assigned collection tags for an asset.
- `GET /api/v1/media/:id/thumbnail` — Serves extracted thumbnail or labeled SVG card.
- `GET /api/v1/media/:id/stream` — HTTP 206 Range streaming for uploaded media.
- `GET /api/v1/media/quality-report` — Returns duplicate groups (SHA-256 & perceptual), low-res clips, unusable files, and reclaimable storage bytes.
- `GET /api/v1/media/collections` & `POST /api/v1/media/collections` — Manage collections.
- `POST /api/v1/media/seed-demo` & `POST /api/v1/media/clear-demo` — Load or clear isolated 150-asset DEMO DATA library.

## Semantic Search (`/api/v1/search`)
- `POST /api/v1/search/semantic` — Hybrid vector + lexical + transcript search `{ query, mediaTypes, sourceTypes, minDuration, maxDuration, limit, page }`.
- `GET /api/v1/search/history` — Recent search queries.
- `DELETE /api/v1/search/history/:id` — Remove search history item.

## Projects & Storyboards (`/api/v1/projects`, `/api/v1/storyboards`)
- `GET/POST /api/v1/projects` & `GET/PATCH/DELETE /api/v1/projects/:id`
- `GET /api/v1/storyboards` — List user storyboards.
- `POST /api/v1/storyboards/generate` — Generate Zod-validated storyboard from prompt and optional `selectedMediaIds`.
- `GET /api/v1/storyboards/:id` — Retrieve storyboard.
- `PATCH /api/v1/storyboards/:id` — Update scene order, trims, captions, transitions, aspect ratio (validates invariants).
- `POST /api/v1/storyboards/:id/regenerate-scene` — Swap single unlocked scene `{ sceneId, instruction }`.
- `POST /api/v1/storyboards/:id/export-plan` — Export editing-ready `json` or `edl` (CMX 3600) production plan.

## AI Content Studio (`/api/v1/content`)
- `POST /api/v1/content/generate-title`
- `POST /api/v1/content/generate-caption`
- `POST /api/v1/content/generate-description`
- `POST /api/v1/content/generate-hashtags`
- `POST /api/v1/content/generate-pack`

## Processing Center (`/api/v1/jobs`)
- `GET /api/v1/jobs` — List background jobs with logs and progress.
- `GET /api/v1/jobs/:id` — Single job details.
- `POST /api/v1/jobs/:id/retry` — Re-queue failed job.

## UGREEN NAS (`/api/v1/nas`)
- `GET /api/v1/nas/status` — Live network/mount verification.
- `POST /api/v1/nas/connect` — Save encrypted NAS connection settings and test reachability.
- `POST /api/v1/nas/sync` — Scan authorized read-only NAS files and enqueue processing.
- `POST /api/v1/nas/disconnect` — Disconnect and scrub stored NAS token.

