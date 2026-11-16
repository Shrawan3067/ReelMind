# ReelMind Storyboard Schema Reference

Every storyboard produced or modified by ReelMind must pass strict Zod validation before persistence or export.

## Invariants Enforced
1. **Source Bounds**: `0 <= sourceStartTime < sourceEndTime <= sourceDuration`
2. **Timeline Continuity**: Scenes are zero-indexed (`order = 0, 1, ..., n-1`) with contiguous `timelineStartTime` and `timelineEndTime` (zero overlaps or unexpected gaps).
3. **Aspect Ratio**: One of `16:9`, `9:16`, `1:1`, or `4:5`.
4. **Supported Transitions**: `cut`, `fade_in`, `fade_out`, `crossfade`, `dissolve`, `wipe`.
5. **Source Attribution**: Every scene carries `mediaAssetId`, `sourceFilename`, `sourceType` (`ugreen_nas` | `local_upload` | `demo`), `isDemoData`, and `evidenceSource` (`visual_analysis` | `transcript` | `metadata` | `hybrid`).

## Illustrative JSON Output
```json
{
  "title": "Summer Pool Adventure",
  "creativeConcept": "A 30-second 16:9 visual narrative built from top-ranked pool scenes.",
  "targetDuration": 30,
  "actualDuration": 30,
  "aspectRatio": "16:9",
  "mood": "Playful & Joyful",
  "scenes": [
    {
      "order": 0,
      "sourceFilename": "dog_pool_01.mp4",
      "sourceType": "ugreen_nas",
      "isDemoData": false,
      "sourceStartTime": 12,
      "sourceEndTime": 17,
      "timelineStartTime": 0,
      "timelineEndTime": 5,
      "transition": "fade_in",
      "caption": "The perfect summer day.",
      "evidenceSource": "visual_analysis"
    }
  ]
}
```

