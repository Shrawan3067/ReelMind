export type MediaType = 'video' | 'image' | 'audio';

export type SourceType = 'ugreen_nas' | 'local_upload' | 'demo';

export type ProcessingStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export type TransitionType = 'cut' | 'fade_in' | 'fade_out' | 'crossfade' | 'dissolve' | 'wipe';

export type EvidenceSource = 'visual_analysis' | 'transcript' | 'metadata' | 'hybrid';

export interface UserPreferences {
  theme: 'dark' | 'light';
  defaultAspectRatio: AspectRatio;
  aiProvider: string;
  autoProcessUploads: boolean;
}

export interface QualityMetrics {
  resolutionScore?: number;
  sharpnessScore?: number;
  bitrate?: number;
  hasAudio?: boolean;
  blurDetected?: boolean;
  blackFramesDetected?: boolean;
  corrupted?: boolean;
  overallScore?: number;
  notes?: string;
}

export interface ClipRankingBreakdown {
  semanticRelevance?: number;
  visualQuality?: number;
  narrativeValue?: number;
  resolutionQuality?: number;
  audioSuitability?: number;
  diversity?: number;
  finalScore: number;
  weightsUsed: Record<string, number>;
  explanation: string;
}

export interface SearchResultItem {
  sceneId: string;
  mediaAssetId: string;
  filename: string;
  sourceType: SourceType;
  mediaType: MediaType;
  thumbnailUrl?: string;
  playbackUrl?: string;
  duration: number;
  startTime: number;
  endTime: number;
  description: string;
  transcript?: string;
  matchScore: number;
  evidenceSource: EvidenceSource;
  explanation: string;
  isDemoData: boolean;
  ranking?: ClipRankingBreakdown;
}

export interface StoryboardScene {
  id: string;
  order: number;
  mediaAssetId: string;
  sourceFilename: string;
  sourceType: SourceType;
  isDemoData: boolean;
  sourceDuration: number;
  sourceStartTime: number;
  sourceEndTime: number;
  timelineStartTime: number;
  timelineEndTime: number;
  description: string;
  caption: string;
  transition: TransitionType;
  editingNotes?: string;
  locked?: boolean;
  thumbnailUrl?: string;
  playbackUrl?: string;
  evidenceSource: EvidenceSource;
}

export interface StoryboardData {
  id?: string;
  projectId: string;
  title: string;
  creativeConcept: string;
  targetDuration: number;
  actualDuration: number;
  aspectRatio: AspectRatio;
  mood: string;
  scenes: StoryboardScene[];
  musicSuggestions: Array<{
    title: string;
    mood: string;
    tempo: string;
    notes: string;
  }>;
  editingNotes: string;
  version: number;
}

