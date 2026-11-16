# ReelMind Companion API Contract

When the ReelMind MERN server is paired with a UGREEN AI NAS deployment, Uliya orchestration workflows map to the following authenticated REST endpoints (`/api/v1`):

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/nas/status` | `GET` | Verifies real UGOS host / mount connectivity without fabricating connection state |
| `/nas/sync` | `POST` | Scans authorized read-only UGOS share paths and queues background indexing jobs |
| `/search/semantic` | `POST` | Executes hybrid cosine vector + lexical + transcript search across indexed scenes |
| `/storyboards/generate` | `POST` | Runs Intent Understanding -> Ranking -> Creative Director -> Zod validation |
| `/storyboards/:id/regenerate-scene` | `POST` | Replaces a single unlocked scene with an alternative shot |
| `/storyboards/:id/export-plan` | `POST` | Exports JSON production plan or CMX 3600 EDL cut list |
| `/content/generate-pack` | `POST` | Generates platform titles, captions, hashtags, hooks, and narration |

