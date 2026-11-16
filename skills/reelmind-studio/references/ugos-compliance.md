# UGOS Compliance & Safety Boundaries

1. **Read-Only NAS Access**: ReelMind only requires read permissions on authorized media directories. Original media on UGOS storage pools is never overwritten, moved, or deleted automatically.
2. **No Unauthorized Binaries or Scripts**: This Skill package (`skills/reelmind-studio`) contains exclusively Markdown instructions and references compliant with `uliya-skill-kit` packaging checks.
3. **Credential Protection**: All NAS tokens and external AI provider keys are encrypted at rest using AES-256-GCM on the ReelMind application server and are never returned in API responses or frontend state.
4. **Honest Evidence & Demo Separation**:
   - Real NAS assets carry `sourceType: "ugreen_nas"` and `isDemoData: false`.
   - Development demo samples carry `sourceType: "demo"` and `isDemoData: true`, rendered with clear `DEMO DATA` indicators.
   - Vision analysis is only reported as `visual_analysis` when a vision-capable model actually inspected extracted frames.

