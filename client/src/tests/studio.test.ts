import { describe, it, expect } from 'vitest';
import { StoryboardSchema } from '@reelmind/shared';
import studioReducer, { toggleSelectedClip, clearSelectedClips } from '../store/studioSlice';

describe('ReelMind Frontend State & Schema Verification', () => {
  it('validates strict StoryboardSchema boundaries and rejects overlaps', () => {
    const valid = StoryboardSchema.safeParse({
      projectId: 'proj_1',
      title: 'Summer Pool Adventure',
      creativeConcept: 'Dog pool fun',
      targetDuration: 30,
      actualDuration: 10,
      aspectRatio: '16:9',
      mood: 'Playful',
      scenes: [
        {
          id: 's1',
          order: 0,
          mediaAssetId: 'm1',
          sourceFilename: 'dog_pool_01.mp4',
          sourceType: 'demo',
          isDemoData: true,
          sourceDuration: 28,
          sourceStartTime: 12,
          sourceEndTime: 17,
          timelineStartTime: 0,
          timelineEndTime: 5,
          description: 'Dog walking to pool',
          caption: 'Summer day',
          transition: 'fade_in',
          evidenceSource: 'metadata'
        },
        {
          id: 's2',
          order: 1,
          mediaAssetId: 'm2',
          sourceFilename: 'dog_pool_03.mp4',
          sourceType: 'demo',
          isDemoData: true,
          sourceDuration: 22,
          sourceStartTime: 5,
          sourceEndTime: 10,
          timelineStartTime: 5,
          timelineEndTime: 10,
          description: 'Dog jumping in pool',
          caption: 'SPLASH!',
          transition: 'crossfade',
          evidenceSource: 'metadata'
        }
      ]
    });
    expect(valid.success).toBe(true);

    // Overlap check
    const overlapping = StoryboardSchema.safeParse({
      projectId: 'proj_1',
      title: 'Broken Timeline',
      creativeConcept: 'Test',
      targetDuration: 30,
      actualDuration: 10,
      aspectRatio: '16:9',
      mood: 'Calm',
      scenes: [
        {
          id: 's1',
          order: 0,
          mediaAssetId: 'm1',
          sourceFilename: 'a.mp4',
          sourceType: 'demo',
          isDemoData: true,
          sourceDuration: 20,
          sourceStartTime: 0,
          sourceEndTime: 5,
          timelineStartTime: 0,
          timelineEndTime: 5,
          description: 'Scene 1',
          transition: 'cut'
        },
        {
          id: 's2',
          order: 1,
          mediaAssetId: 'm2',
          sourceFilename: 'b.mp4',
          sourceType: 'demo',
          isDemoData: true,
          sourceDuration: 20,
          sourceStartTime: 0,
          sourceEndTime: 5,
          timelineStartTime: 3, // Overlap with s1!
          timelineEndTime: 8,
          description: 'Scene 2',
          transition: 'cut'
        }
      ]
    });
    expect(overlapping.success).toBe(false);
  });

  it('toggles selected clips cleanly in studio Redux slice', () => {
    const clip = {
      sceneId: 'sc1',
      mediaAssetId: 'ma1',
      filename: 'dog_pool_03.mp4',
      sourceType: 'demo' as const,
      mediaType: 'video' as const,
      duration: 22,
      startTime: 5,
      endTime: 15,
      description: 'Dog splashing',
      matchScore: 0.96,
      evidenceSource: 'metadata' as const,
      explanation: 'Matched dog & pool',
      isDemoData: true
    };

    const s1 = studioReducer(undefined, toggleSelectedClip(clip));
    expect(s1.selectedClips.length).toBe(1);

    const s2 = studioReducer(s1, toggleSelectedClip(clip));
    expect(s2.selectedClips.length).toBe(0);

    const s3 = studioReducer(s1, clearSelectedClips());
    expect(s3.selectedClips.length).toBe(0);
  });
});

