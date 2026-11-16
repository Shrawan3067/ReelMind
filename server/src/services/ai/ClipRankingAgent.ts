import { ClipRankingBreakdown, EvidenceSource } from '@reelmind/shared';

export interface RankingInputMetrics {
  semanticRelevance: number; // 0..1 (required)
  visualQuality?: number; // 0..1 (only when visual/technical quality analyzed)
  narrativeValue?: number; // 0..1
  resolutionWidth?: number; // pixels
  hasAudio?: boolean;
  diversityScore?: number; // 0..1
  evidenceSource: EvidenceSource;
}

const DEFAULT_WEIGHTS = {
  semanticRelevance: 0.35,
  visualQuality: 0.20,
  narrativeValue: 0.15,
  resolutionQuality: 0.10,
  audioSuitability: 0.10,
  diversity: 0.10
} as const;

export class ClipRankingAgent {
  public scoreCandidate(metrics: RankingInputMetrics): ClipRankingBreakdown {
    const activeDimensions: Array<{ key: keyof typeof DEFAULT_WEIGHTS; value: number; baseWeight: number }> = [];

    activeDimensions.push({
      key: 'semanticRelevance',
      value: Math.max(0, Math.min(1, metrics.semanticRelevance)),
      baseWeight: DEFAULT_WEIGHTS.semanticRelevance
    });

    if (metrics.visualQuality !== undefined && metrics.visualQuality > 0) {
      activeDimensions.push({
        key: 'visualQuality',
        value: Math.max(0, Math.min(1, metrics.visualQuality)),
        baseWeight: DEFAULT_WEIGHTS.visualQuality
      });
    }

    if (metrics.narrativeValue !== undefined) {
      activeDimensions.push({
        key: 'narrativeValue',
        value: Math.max(0, Math.min(1, metrics.narrativeValue)),
        baseWeight: DEFAULT_WEIGHTS.narrativeValue
      });
    }

    if (metrics.resolutionWidth && metrics.resolutionWidth > 0) {
      const resScore =
        metrics.resolutionWidth >= 3840
          ? 1.0
          : metrics.resolutionWidth >= 1920
          ? 0.9
          : metrics.resolutionWidth >= 1280
          ? 0.72
          : 0.45;
      activeDimensions.push({
        key: 'resolutionQuality',
        value: resScore,
        baseWeight: DEFAULT_WEIGHTS.resolutionQuality
      });
    }

    if (metrics.hasAudio !== undefined) {
      activeDimensions.push({
        key: 'audioSuitability',
        value: metrics.hasAudio ? 0.9 : 0.45,
        baseWeight: DEFAULT_WEIGHTS.audioSuitability
      });
    }

    if (metrics.diversityScore !== undefined) {
      activeDimensions.push({
        key: 'diversity',
        value: Math.max(0, Math.min(1, metrics.diversityScore)),
        baseWeight: DEFAULT_WEIGHTS.diversity
      });
    }

    // Renormalize weights so active dimensions sum to 1.0
    const weightSum = activeDimensions.reduce((acc, d) => acc + d.baseWeight, 0);
    const weightsUsed: Record<string, number> = {};
    let finalScore = 0;

    const breakdown: ClipRankingBreakdown = {
      finalScore: 0,
      weightsUsed,
      explanation: ''
    };

    for (const dim of activeDimensions) {
      const normalizedWeight = weightSum > 0 ? Number((dim.baseWeight / weightSum).toFixed(4)) : 0;
      weightsUsed[dim.key] = normalizedWeight;
      finalScore += dim.value * normalizedWeight;
      (breakdown as unknown as Record<string, unknown>)[dim.key] = Number(dim.value.toFixed(3));
    }

    breakdown.finalScore = Number(finalScore.toFixed(4));
    const topDim = [...activeDimensions].sort((a, b) => b.value * b.baseWeight - a.value * a.baseWeight)[0];

    breakdown.explanation = `Scored ${Math.round(breakdown.finalScore * 100)}% across ${activeDimensions.length} available metrics (renormalized weights). Strongest factor: ${topDim.key} (${Math.round(topDim.value * 100)}%). Evidence: ${metrics.evidenceSource}.`;

    return breakdown;
  }
}

