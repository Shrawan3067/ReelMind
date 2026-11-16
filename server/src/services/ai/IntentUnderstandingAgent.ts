import { z } from 'zod';
import { AspectRatio } from '@reelmind/shared';
import { AIProviderAdapter } from '../../adapters/ai/AIProviderAdapter';

export const ParsedIntentSchema = z.object({
  coreSubjectQuery: z.string(),
  visualKeywords: z.array(z.string()),
  mood: z.string(),
  targetDurationSeconds: z.number().min(5).max(300),
  suggestedAspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']),
  styleNotes: z.string()
});

export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

export class IntentUnderstandingAgent {
  public async parseCreativeRequest(
    prompt: string,
    aiAdapter: AIProviderAdapter,
    defaults?: { targetDuration?: number; aspectRatio?: AspectRatio; mood?: string }
  ): Promise<ParsedIntent> {
    const caps = aiAdapter.getCapabilities();
    if (caps.llmAvailable) {
      const llmRes = await aiAdapter.generateStructuredJson(
        `You are an Intent Understanding Agent for an AI video studio. Extract structured creative intent from the user's request. Return valid JSON matching:
        { "coreSubjectQuery": string, "visualKeywords": string[], "mood": string, "targetDurationSeconds": number, "suggestedAspectRatio": "16:9" | "9:16" | "1:1" | "4:5", "styleNotes": string }`,
        prompt,
        ParsedIntentSchema
      );
      if (llmRes.data) {
        return {
          ...llmRes.data,
          targetDurationSeconds: defaults?.targetDuration || llmRes.data.targetDurationSeconds,
          suggestedAspectRatio: defaults?.aspectRatio || llmRes.data.suggestedAspectRatio,
          mood: defaults?.mood || llmRes.data.mood
        };
      }
    }

    return this.deterministicParse(prompt, defaults);
  }

  public deterministicParse(
    prompt: string,
    defaults?: { targetDuration?: number; aspectRatio?: AspectRatio; mood?: string }
  ): ParsedIntent {
    const lower = prompt.toLowerCase();

    // Extract duration if explicitly mentioned (e.g., "30-second", "45 sec", "1 minute")
    let parsedDuration = defaults?.targetDuration || 30;
    const secMatch = lower.match(/(\d+)\s*[-\s]?(?:second|seconds|sec|s)\b/);
    const minMatch = lower.match(/(\d+)\s*[-\s]?(?:minute|minutes|min)\b/);
    if (!defaults?.targetDuration) {
      if (secMatch) {
        parsedDuration = Math.min(300, Math.max(5, parseInt(secMatch[1], 10)));
      } else if (minMatch) {
        parsedDuration = Math.min(300, Math.max(15, parseInt(minMatch[1], 10) * 60));
      }
    }

    // Infer aspect ratio
    let aspectRatio: AspectRatio = defaults?.aspectRatio || '16:9';
    if (!defaults?.aspectRatio) {
      if (/\b(shorts|reels|tiktok|vertical|9:16)\b/.test(lower)) {
        aspectRatio = '9:16';
      } else if (/\b(square|1:1)\b/.test(lower)) {
        aspectRatio = '1:1';
      } else if (/\b(portrait|4:5|instagram feed)\b/.test(lower)) {
        aspectRatio = '4:5';
      }
    }

    // Infer mood
    let mood = defaults?.mood || 'Cinematic & Engaging';
    if (/\b(cinematic|epic|dramatic)\b/.test(lower)) mood = 'Cinematic & Uplifting';
    else if (/\b(energetic|fast|hype|upbeat|action|ad|commercial)\b/.test(lower)) mood = 'Energetic & Dynamic';
    else if (/\b(calm|relaxing|peaceful|sunset|chill)\b/.test(lower)) mood = 'Warm & Serene';
    else if (/\b(funny|laugh|happy|playful|summer|joy)\b/.test(lower)) mood = 'Playful & Joyful';

    // Stopword removal for clean core keywords
    const stopWords = new Set([
      'find', 'every', 'all', 'clip', 'clips', 'video', 'videos', 'scene', 'scenes',
      'footage', 'where', 'with', 'that', 'this', 'from', 'into', 'create', 'make',
      'build', 'generate', 'show', 'me', 'the', 'a', 'an', 'of', 'for', 'and', 'to',
      'about', 'second', 'seconds', 'minute', 'cinematic', 'short', 'reel', 'montage',
      'suitable', 'containing', 'someone', 'person'
    ]);

    const tokens = lower
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopWords.has(t) && !/^\d+$/.test(t));

    const uniqueKeywords = Array.from(new Set(tokens));

    return {
      coreSubjectQuery: uniqueKeywords.length > 0 ? uniqueKeywords.join(' ') : prompt,
      visualKeywords: uniqueKeywords,
      mood,
      targetDurationSeconds: parsedDuration,
      suggestedAspectRatio: aspectRatio,
      styleNotes: `Matched intent from query: "${prompt}"`
    };
  }
}

