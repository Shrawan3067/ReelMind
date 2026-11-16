import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  GenerateStoryboardInput,
  StoryboardData,
  StoryboardScene,
  StoryboardSchema,
  TransitionType,
  SearchResultItem
} from '@reelmind/shared';
import { ProjectModel } from '../../models/Project';
import { StoryboardModel, IStoryboard } from '../../models/Storyboard';
import { MediaAssetModel } from '../../models/MediaAsset';
import { SceneModel } from '../../models/Scene';
import { UserModel } from '../../models/User';
import { AIProviderAdapter } from '../../adapters/ai/AIProviderAdapter';
import { IntentUnderstandingAgent } from '../ai/IntentUnderstandingAgent';
import { SemanticSearchService } from '../search/SemanticSearchService';
import { BadRequestError, NotFoundError } from '../../utils/errors';

const LlmStoryboardPlanSchema = z.object({
  title: z.string(),
  creativeConcept: z.string(),
  mood: z.string(),
  editingNotes: z.string(),
  musicSuggestions: z.array(
    z.object({
      title: z.string(),
      mood: z.string(),
      tempo: z.string(),
      notes: z.string()
    })
  ),
  selectedScenes: z.array(
    z.object({
      sceneId: z.string(),
      allocatedDuration: z.number().min(2).max(30),
      transition: z.enum(['cut', 'fade_in', 'fade_out', 'crossfade', 'dissolve', 'wipe']),
      caption: z.string(),
      editingNotes: z.string().optional()
    })
  )
});

export class StoryboardService {
  private readonly intentAgent = new IntentUnderstandingAgent();
  private readonly searchService = new SemanticSearchService();

  public async generateStoryboard(
    ownerId: string,
    input: GenerateStoryboardInput
  ): Promise<{ project: Record<string, unknown>; storyboard: StoryboardData; candidatesEvaluated: number }> {
    const user = await UserModel.findById(ownerId);
    const aiAdapter = AIProviderAdapter.fromUserOrEnv(user?.aiConfig);

    // 1. Intent Understanding Agent
    const intent = await this.intentAgent.parseCreativeRequest(input.prompt, aiAdapter, {
      targetDuration: input.targetDuration,
      aspectRatio: input.aspectRatio,
      mood: input.mood
    });

    // 2. Candidate Discovery
    let candidates: SearchResultItem[] = [];

    if (input.selectedMediaIds && input.selectedMediaIds.length > 0) {
      // User explicitly pinned clips from AI Search Studio
      const pinnedAssets = await MediaAssetModel.find({
        _id: { $in: input.selectedMediaIds.map(id => new mongoose.Types.ObjectId(id)) },
        ownerId: new mongoose.Types.ObjectId(ownerId)
      }).lean();

      const pinnedScenes = await SceneModel.find({
        mediaAssetId: { $in: pinnedAssets.map(a => a._id) },
        ownerId: new mongoose.Types.ObjectId(ownerId)
      }).lean();

      for (const asset of pinnedAssets) {
        const assetScenes = pinnedScenes.filter(
          s => s.mediaAssetId.toString() === asset._id.toString()
        );
        const primaryScene = assetScenes[0];
        const duration = asset.duration || (asset.mediaType === 'image' ? 5 : 15);
        candidates.push({
          sceneId: primaryScene?._id.toString() || asset._id.toString(),
          mediaAssetId: asset._id.toString(),
          filename: asset.filename,
          sourceType: asset.sourceType,
          mediaType: asset.mediaType,
          thumbnailUrl: asset.thumbnailReference || `/api/v1/media/${asset._id.toString()}/thumbnail`,
          playbackUrl: `/api/v1/media/${asset._id.toString()}/stream`,
          duration,
          startTime: primaryScene?.startTime ?? 0,
          endTime: primaryScene?.endTime ?? Math.min(duration, 10),
          description: primaryScene?.description || asset.metadata?.summary || asset.filename,
          transcript: primaryScene?.transcript,
          matchScore: 0.95,
          evidenceSource: primaryScene?.analysisSource || 'metadata',
          explanation: 'User-selected clip from Media / Search Studio',
          isDemoData: asset.isDemoData
        });
      }
    } else {
      const searchRes = await this.searchService.executeHybridSearch(
        ownerId,
        {
          query: intent.coreSubjectQuery || input.prompt,
          mediaTypes: ['video', 'image'],
          sourceTypes: input.includeDemoMedia ? undefined : ['local_upload', 'ugreen_nas'],
          limit: 16,
          page: 1
        },
        true
      );
      candidates = searchRes.results;
    }

    if (candidates.length === 0) {
      throw new BadRequestError(
        'No matching indexed media clips were found in your library for this prompt. Upload media or load Demo Data first.'
      );
    }

    // Filter out zero-duration invalid clips unless image (images become 4s motion stills)
    const usableCandidates = candidates.filter(c => c.mediaType === 'image' || c.duration > 0);
    if (usableCandidates.length === 0) {
      throw new BadRequestError('Found matching media assets, but none contain valid playable duration metadata.');
    }

    // 3. Creative Director & Storyboard Planning (LLM when available, deterministic fallback otherwise)
    let rawPlan: z.infer<typeof LlmStoryboardPlanSchema> | null = null;
    const caps = aiAdapter.getCapabilities();

    if (caps.llmAvailable) {
      const candidateContext = usableCandidates.slice(0, 10).map(c => ({
        sceneId: c.sceneId,
        filename: c.filename,
        duration: c.duration,
        sceneStart: c.startTime,
        sceneEnd: c.endTime,
        description: c.description,
        matchScore: c.matchScore
      }));

      const llmResult = await aiAdapter.generateStructuredJson(
        `You are the ReelMind Creative Director & Storyboard Generator.
        Create a tightly paced ${intent.targetDurationSeconds}-second video storyboard using ONLY the provided real candidate sceneIds.
        NEVER invent sceneIds or filenames.
        Return valid JSON matching:
        {
          "title": string,
          "creativeConcept": string,
          "mood": string,
          "editingNotes": string,
          "musicSuggestions": [{ "title": string, "mood": string, "tempo": string, "notes": string }],
          "selectedScenes": [{ "sceneId": string, "allocatedDuration": number, "transition": "cut"|"fade_in"|"fade_out"|"crossfade"|"dissolve"|"wipe", "caption": string, "editingNotes": string }]
        }`,
        `User Prompt: "${input.prompt}"\nTarget Duration: ${intent.targetDurationSeconds}s\nAspect Ratio: ${intent.suggestedAspectRatio}\nAvailable Candidates:\n${JSON.stringify(candidateContext, null, 2)}`,
        LlmStoryboardPlanSchema
      );
      rawPlan = llmResult.data;
    }

    // 4. Deterministic Sequencing & Strict Timestamp Boundary Verification
    const candidateBySceneId = new Map(usableCandidates.map(c => [c.sceneId, c]));
    const storyboardScenes: StoryboardScene[] = [];
    const targetDuration = intent.targetDurationSeconds;
    let currentTimelinePos = 0;

    if (rawPlan && rawPlan.selectedScenes.length > 0) {
      let order = 0;
      for (const item of rawPlan.selectedScenes) {
        const cand = candidateBySceneId.get(item.sceneId);
        if (!cand) continue; // Ignore hallucinated sceneId

        const realDur = cand.mediaType === 'image' ? 8 : cand.duration;
        const maxAvailableFromSceneStart = Math.max(1, realDur - cand.startTime);
        const remainingNeeded = Math.max(2, targetDuration - currentTimelinePos);
        const clipLen = Number(
          Math.min(item.allocatedDuration, maxAvailableFromSceneStart, remainingNeeded).toFixed(2)
        );
        if (clipLen < 1.5) continue;

        const sourceStart = Number(Math.max(0, Math.min(cand.startTime, realDur - clipLen)).toFixed(2));
        const sourceEnd = Number((sourceStart + clipLen).toFixed(2));
        const timelineStart = Number(currentTimelinePos.toFixed(2));
        const timelineEnd = Number((timelineStart + clipLen).toFixed(2));

        storyboardScenes.push({
          id: uuidv4(),
          order: order++,
          mediaAssetId: cand.mediaAssetId,
          sourceFilename: cand.filename,
          sourceType: cand.sourceType,
          isDemoData: cand.isDemoData,
          sourceDuration: realDur,
          sourceStartTime: sourceStart,
          sourceEndTime: sourceEnd,
          timelineStartTime: timelineStart,
          timelineEndTime: timelineEnd,
          description: cand.description,
          caption: item.caption,
          transition: item.transition,
          editingNotes: item.editingNotes,
          locked: false,
          thumbnailUrl: cand.thumbnailUrl,
          playbackUrl: cand.playbackUrl,
          evidenceSource: cand.evidenceSource
        });

        currentTimelinePos = timelineEnd;
        if (currentTimelinePos >= targetDuration - 0.5) break;
      }
    }

    // Deterministic Creative Director Assembly (used if LLM not configured or produced insufficient scenes)
    if (storyboardScenes.length === 0) {
      const selectedPool = this.selectDiverseTopCandidates(usableCandidates, targetDuration);
      const count = selectedPool.length;
      const baseClipLen = Math.max(3, Number((targetDuration / count).toFixed(2)));
      const transitions: TransitionType[] = ['fade_in', 'cut', 'crossfade', 'dissolve', 'fade_out'];

      for (let i = 0; i < count; i++) {
        const cand = selectedPool[i];
        const realDur = cand.mediaType === 'image' ? 6 : cand.duration;
        const isLast = i === count - 1;
        const remaining = Number((targetDuration - currentTimelinePos).toFixed(2));
        let desiredLen = isLast ? Math.max(2, remaining) : baseClipLen;

        // Clamp strictly against actual source duration
        const sceneSpan = cand.endTime > cand.startTime ? cand.endTime - cand.startTime : realDur;
        const availableSpan = Math.min(realDur, Math.max(sceneSpan, realDur - cand.startTime));
        desiredLen = Number(Math.min(desiredLen, availableSpan).toFixed(2));
        if (desiredLen <= 0.5) desiredLen = Math.min(realDur, 3);

        const sourceStart = Number(Math.max(0, Math.min(cand.startTime, realDur - desiredLen)).toFixed(2));
        const sourceEnd = Number((sourceStart + desiredLen).toFixed(2));
        const timelineStart = Number(currentTimelinePos.toFixed(2));
        const timelineEnd = Number((timelineStart + desiredLen).toFixed(2));

        const transition: TransitionType =
          i === 0 ? 'fade_in' : isLast ? 'crossfade' : transitions[i % (transitions.length - 1)] || 'cut';

        storyboardScenes.push({
          id: uuidv4(),
          order: i,
          mediaAssetId: cand.mediaAssetId,
          sourceFilename: cand.filename,
          sourceType: cand.sourceType,
          isDemoData: cand.isDemoData,
          sourceDuration: realDur,
          sourceStartTime: sourceStart,
          sourceEndTime: sourceEnd,
          timelineStartTime: timelineStart,
          timelineEndTime: timelineEnd,
          description: cand.description,
          caption: this.buildSceneCaption(cand.description, i, count),
          transition,
          editingNotes: `Selected via ranking score ${Math.round(cand.matchScore * 100)}%. ${cand.explanation}`,
          locked: false,
          thumbnailUrl: cand.thumbnailUrl,
          playbackUrl: cand.playbackUrl,
          evidenceSource: cand.evidenceSource
        });

        currentTimelinePos = timelineEnd;
      }
    }

    const actualDuration = Number(currentTimelinePos.toFixed(2));
    const title = rawPlan?.title || this.deriveProjectTitle(input.prompt, intent.mood);
    const creativeConcept =
      rawPlan?.creativeConcept ||
      `A ${actualDuration}-second ${intent.suggestedAspectRatio} visual narrative built from ${storyboardScenes.length} top-ranked clips matching "${input.prompt}".`;

    const project = await ProjectModel.create({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      title,
      description: creativeConcept,
      prompt: input.prompt,
      targetDuration,
      aspectRatio: intent.suggestedAspectRatio,
      status: 'in_progress',
      selectedMedia: Array.from(
        new Set(storyboardScenes.map(s => new mongoose.Types.ObjectId(s.mediaAssetId)))
      )
    });

    const storyboardPayload: StoryboardData = {
      projectId: project._id.toString(),
      title,
      creativeConcept,
      targetDuration,
      actualDuration,
      aspectRatio: intent.suggestedAspectRatio,
      mood: rawPlan?.mood || intent.mood,
      scenes: storyboardScenes,
      musicSuggestions:
        rawPlan?.musicSuggestions || this.defaultMusicSuggestions(intent.mood, actualDuration),
      editingNotes:
        rawPlan?.editingNotes ||
        'Cut cleanly on motion beats. Normalize audio levels across clips to -14 LUFS.',
      version: 1
    };

    // Strict Zod validation before persistence
    const validated = StoryboardSchema.parse(storyboardPayload);

    const savedStoryboard = await StoryboardModel.create({
      ...validated,
      ownerId: new mongoose.Types.ObjectId(ownerId),
      projectId: project._id
    });

    project.activeStoryboardId = savedStoryboard._id;
    await project.save();

    return {
      project: { ...project.toObject(), id: project._id.toString() } as unknown as Record<string, unknown>,
      storyboard: this.formatStoryboardDoc(savedStoryboard),
      candidatesEvaluated: usableCandidates.length
    };
  }

  public async getStoryboardById(storyboardId: string, ownerId: string): Promise<StoryboardData> {
    const doc = await StoryboardModel.findOne({ _id: storyboardId, ownerId });
    if (!doc) {
      throw new NotFoundError('Storyboard not found');
    }
    return this.formatStoryboardDoc(doc);
  }

  public async updateStoryboard(
    storyboardId: string,
    ownerId: string,
    updates: Partial<StoryboardData>
  ): Promise<StoryboardData> {
    const doc = await StoryboardModel.findOne({ _id: storyboardId, ownerId });
    if (!doc) {
      throw new NotFoundError('Storyboard not found');
    }

    const plain = doc.toObject();
    const mergedScenes = updates.scenes ? this.recalculateTimeline(updates.scenes) : plain.scenes;
    const actualDuration = mergedScenes.length > 0 ? mergedScenes[mergedScenes.length - 1].timelineEndTime : 0;

    const candidateObj: StoryboardData = {
      id: doc._id.toString(),
      projectId: doc.projectId.toString(),
      title: updates.title ?? plain.title,
      creativeConcept: updates.creativeConcept ?? plain.creativeConcept,
      targetDuration: updates.targetDuration ?? plain.targetDuration,
      actualDuration: Number(actualDuration.toFixed(2)),
      aspectRatio: updates.aspectRatio ?? plain.aspectRatio,
      mood: updates.mood ?? plain.mood,
      scenes: mergedScenes,
      musicSuggestions: updates.musicSuggestions ?? plain.musicSuggestions,
      editingNotes: updates.editingNotes ?? plain.editingNotes,
      version: plain.version + 1
    };

    const parsed = StoryboardSchema.safeParse(candidateObj);
    if (!parsed.success) {
      throw new BadRequestError('Storyboard validation failed', parsed.error.issues);
    }
    const validated = parsed.data;

    doc.title = validated.title;
    doc.creativeConcept = validated.creativeConcept;
    doc.targetDuration = validated.targetDuration;
    doc.actualDuration = validated.actualDuration;
    doc.aspectRatio = validated.aspectRatio;
    doc.mood = validated.mood;
    doc.scenes = validated.scenes;
    doc.musicSuggestions = validated.musicSuggestions;
    doc.editingNotes = validated.editingNotes;
    doc.version = validated.version;

    await doc.save();
    return this.formatStoryboardDoc(doc);
  }

  public async regenerateScene(
    storyboardId: string,
    ownerId: string,
    sceneId: string,
    instruction?: string
  ): Promise<StoryboardData> {
    const doc = await StoryboardModel.findOne({ _id: storyboardId, ownerId });
    if (!doc) {
      throw new NotFoundError('Storyboard not found');
    }

    const plain = doc.toObject();
    const idx = plain.scenes.findIndex(s => s.id === sceneId);
    if (idx === -1) {
      throw new NotFoundError('Scene not found in storyboard');
    }

    const targetScene = plain.scenes[idx];
    if (targetScene.locked) {
      throw new BadRequestError('This scene is locked. Unlock it before regenerating.');
    }

    const queryText = instruction || `${plain.creativeConcept} ${targetScene.description}`;
    const searchRes = await this.searchService.executeHybridSearch(
      ownerId,
      {
        query: queryText,
        mediaTypes: ['video', 'image'],
        limit: 12,
        page: 1
      },
      false
    );

    const usedAssetIds = new Set(plain.scenes.map(s => s.mediaAssetId));
    const alternative =
      searchRes.results.find(r => !usedAssetIds.has(r.mediaAssetId)) ||
      searchRes.results.find(r => r.mediaAssetId !== targetScene.mediaAssetId) ||
      searchRes.results[0];

    if (!alternative) {
      throw new BadRequestError('No alternative matching scene found in library.');
    }

    const desiredDur = Number((targetScene.timelineEndTime - targetScene.timelineStartTime).toFixed(2));
    const realDur = alternative.mediaType === 'image' ? 8 : alternative.duration;
    const clippedDur = Number(Math.min(desiredDur, realDur).toFixed(2));
    const startT = Number(Math.max(0, Math.min(alternative.startTime, realDur - clippedDur)).toFixed(2));

    const updatedScenes = [...plain.scenes];
    updatedScenes[idx] = {
      ...targetScene,
      mediaAssetId: alternative.mediaAssetId,
      sourceFilename: alternative.filename,
      sourceType: alternative.sourceType,
      isDemoData: alternative.isDemoData,
      sourceDuration: realDur,
      sourceStartTime: startT,
      sourceEndTime: Number((startT + clippedDur).toFixed(2)),
      description: alternative.description,
      caption: instruction ? `${alternative.description.split('.')[0]}.` : targetScene.caption,
      thumbnailUrl: alternative.thumbnailUrl,
      playbackUrl: alternative.playbackUrl,
      evidenceSource: alternative.evidenceSource,
      editingNotes: `Regenerated scene alternative (${Math.round(alternative.matchScore * 100)}% match).`
    };

    return this.updateStoryboard(storyboardId, ownerId, { scenes: updatedScenes });
  }

  public recalculateTimeline(scenes: StoryboardScene[]): StoryboardScene[] {
    let cursor = 0;
    return scenes.map((s, index) => {
      const clipDuration = Math.max(0.5, Number((s.sourceEndTime - s.sourceStartTime).toFixed(2)));
      const clampedEnd = Math.min(s.sourceDuration, Number((s.sourceStartTime + clipDuration).toFixed(2)));
      const effectiveDur = Math.max(0.5, Number((clampedEnd - s.sourceStartTime).toFixed(2)));

      const start = Number(cursor.toFixed(2));
      const end = Number((cursor + effectiveDur).toFixed(2));
      cursor = end;

      return {
        ...s,
        order: index,
        sourceEndTime: clampedEnd,
        timelineStartTime: start,
        timelineEndTime: end
      };
    });
  }

  private selectDiverseTopCandidates(candidates: SearchResultItem[], targetDuration: number): SearchResultItem[] {
    const desiredCount = Math.min(candidates.length, Math.max(3, Math.min(6, Math.round(targetDuration / 6))));
    const chosen: SearchResultItem[] = [];
    const usedFiles = new Set<string>();

    for (const cand of candidates) {
      if (!usedFiles.has(cand.mediaAssetId)) {
        chosen.push(cand);
        usedFiles.add(cand.mediaAssetId);
      }
      if (chosen.length >= desiredCount) break;
    }

    if (chosen.length < desiredCount) {
      for (const cand of candidates) {
        if (!chosen.includes(cand)) {
          chosen.push(cand);
        }
        if (chosen.length >= desiredCount) break;
      }
    }

    return chosen;
  }

  private buildSceneCaption(description: string, idx: number, total: number): string {
    if (idx === 0) return 'Setting the scene.';
    if (idx === total - 1) return 'Living the moment.';
    const firstSentence = description.split(/[.!?]/)[0]?.trim();
    if (!firstSentence) return `Scene ${idx + 1}`;
    return firstSentence.length > 52 ? `${firstSentence.slice(0, 49)}...` : firstSentence;
  }

  private deriveProjectTitle(prompt: string, mood: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('dog') && lower.includes('pool')) return 'Summer Pool Adventure';
    if (lower.includes('beach') || lower.includes('sunset') || lower.includes('mountain')) return 'Golden Horizon Travel Montage';
    if (lower.includes('product') || lower.includes('ad') || lower.includes('commercial')) return 'Studio Flagship Showcase';
    const cleaned = prompt.replace(/create a \d+[-\s]?second/i, '').trim();
    const words = cleaned.split(/\s+/).slice(0, 5).join(' ');
    return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : `${mood} Cut`;
  }

  private defaultMusicSuggestions(mood: string, duration: number) {
    return [
      {
        title: mood.includes('Playful') ? 'Sunlit Acoustic Bounce' : 'Horizon Cinematic Pulse',
        mood,
        tempo: mood.includes('Energetic') ? '124 BPM' : '96 BPM',
        notes: `Instrumental bed arranged to peak at ${(duration * 0.55).toFixed(0)}s for main action beat.`
      },
      {
        title: 'Ambient Felt & Synth Swell',
        mood: 'Warm & Emotional',
        tempo: '84 BPM',
        notes: 'Subtle atmospheric alternative allowing dialogue or natural ambient sound to breathe.'
      }
    ];
  }

  private formatStoryboardDoc(doc: IStoryboard): StoryboardData {
    return {
      id: doc._id.toString(),
      projectId: doc.projectId.toString(),
      title: doc.title,
      creativeConcept: doc.creativeConcept,
      targetDuration: doc.targetDuration,
      actualDuration: doc.actualDuration,
      aspectRatio: doc.aspectRatio,
      mood: doc.mood,
      scenes: doc.scenes,
      musicSuggestions: doc.musicSuggestions,
      editingNotes: doc.editingNotes,
      version: doc.version
    };
  }
}
