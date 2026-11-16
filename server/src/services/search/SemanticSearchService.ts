import mongoose from 'mongoose';
import {
  SearchResultItem,
  SemanticSearchInput,
  EvidenceSource
} from '@reelmind/shared';
import { MediaAssetModel, IMediaAsset } from '../../models/MediaAsset';
import { SceneModel, IScene } from '../../models/Scene';
import { SearchHistoryModel } from '../../models/SearchHistory';
import { UserModel } from '../../models/User';
import { AIProviderAdapter } from '../../adapters/ai/AIProviderAdapter';
import { computeLocalEmbedding, cosineSimilarity } from '../../adapters/ai/LocalDeterministicEmbedding';
import { ClipRankingAgent } from '../ai/ClipRankingAgent';

export class SemanticSearchService {
  private readonly rankingAgent = new ClipRankingAgent();

  public async executeHybridSearch(
    ownerId: string,
    input: SemanticSearchInput,
    saveToHistory = true
  ): Promise<{
    results: SearchResultItem[];
    totalMatched: number;
    queryEmbeddingModel: string;
    searchMode: string;
  }> {
    const user = await UserModel.findById(ownerId);
    const aiAdapter = AIProviderAdapter.fromUserOrEnv(user?.aiConfig);

    // 1. Metadata Pre-filtering on MediaAssets owned by this user
    const assetFilter: Record<string, unknown> = {
      ownerId: new mongoose.Types.ObjectId(ownerId)
    };
    if (input.mediaTypes && input.mediaTypes.length > 0) {
      assetFilter.mediaType = { $in: input.mediaTypes };
    }
    if (input.sourceTypes && input.sourceTypes.length > 0) {
      assetFilter.sourceType = { $in: input.sourceTypes };
    }
    if (input.minDuration !== undefined || input.maxDuration !== undefined) {
      const durFilter: Record<string, number> = {};
      if (input.minDuration !== undefined) durFilter.$gte = input.minDuration;
      if (input.maxDuration !== undefined) durFilter.$lte = input.maxDuration;
      assetFilter.duration = durFilter;
    }

    const matchingAssets = await MediaAssetModel.find(assetFilter).lean();
    if (matchingAssets.length === 0) {
      return {
        results: [],
        totalMatched: 0,
        queryEmbeddingModel: 'none',
        searchMode: 'hybrid_empty'
      };
    }

    const assetMap = new Map<string, IMediaAsset>();
    const assetIds: mongoose.Types.ObjectId[] = [];
    for (const a of matchingAssets) {
      assetMap.set(a._id.toString(), a as unknown as IMediaAsset);
      assetIds.push(a._id as mongoose.Types.ObjectId);
    }

    // 2. Query embedding generation
    const { vector: providerQueryVector, model: queryEmbeddingModel } = await aiAdapter.generateEmbedding(input.query);
    const localQueryVector = computeLocalEmbedding(input.query);

    // 3. Retrieve scenes belonging to filtered assets
    const scenes = await SceneModel.find({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      mediaAssetId: { $in: assetIds }
    }).lean();

    // Parse query tokens for lexical & transcript exact/partial signal
    const stopWords = new Set(['find', 'every', 'all', 'clip', 'clips', 'video', 'videos', 'scene', 'scenes', 'where', 'with', 'the', 'a', 'an', 'of', 'in', 'into', 'for', 'and', 'to', 'show', 'me', 'footage']);
    const queryTokens = input.query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !stopWords.has(t));

    // 4. Hybrid scoring (Semantic Vector + Lexical Description/Objects/Actions + Transcript + Filename)
    interface RawCandidate {
      scene: IScene;
      asset: IMediaAsset;
      semanticScore: number;
      lexicalScore: number;
      transcriptMatched: boolean;
      matchedKeywords: string[];
      evidenceSource: EvidenceSource;
    }

    const rawCandidates: RawCandidate[] = [];

    for (const s of scenes) {
      const asset = assetMap.get(s.mediaAssetId.toString());
      if (!asset) continue;

      // Semantic cosine similarity (align vector dims cleanly)
      let vectorSim = 0;
      const emb = s.embedding || [];
      if (emb.length > 0 && emb.length === providerQueryVector.length) {
        vectorSim = cosineSimilarity(providerQueryVector, emb);
      } else if (emb.length > 0 && emb.length === localQueryVector.length) {
        vectorSim = cosineSimilarity(localQueryVector, emb);
      } else {
        // Fallback compute local embedding against semanticRepresentation
        const fallbackVec = computeLocalEmbedding(s.semanticRepresentation || s.description);
        vectorSim = cosineSimilarity(localQueryVector, fallbackVec);
      }

      // Lexical & Transcript matching
      const descText = `${s.description} ${(s.detectedObjects || []).join(' ')} ${(s.detectedActions || []).join(' ')} ${asset.filename} ${(asset.metadata?.tags || []).join(' ')}`.toLowerCase();
      const transcriptText = (s.transcript || asset.metadata?.audioTranscript || '').toLowerCase();

      let matchedCount = 0;
      let transcriptHits = 0;
      const matchedKeywords: string[] = [];

      for (const tok of queryTokens) {
        const inDesc = descText.includes(tok);
        const inTrans = transcriptText.includes(tok);
        if (inDesc || inTrans) {
          matchedCount++;
          matchedKeywords.push(tok);
          if (inTrans) transcriptHits++;
        }
      }

      const lexicalScore = queryTokens.length > 0 ? matchedCount / queryTokens.length : 0.5;
      const combinedRelevance = Math.min(1, vectorSim * 0.55 + lexicalScore * 0.45);

      // Threshold out irrelevant noise unless query is empty/wildcard
      if (queryTokens.length > 0 && combinedRelevance < 0.22 && matchedCount === 0) {
        continue;
      }

      let evidenceSource: EvidenceSource = s.analysisSource || 'metadata';
      if (transcriptHits > 0 && evidenceSource === 'metadata') {
        evidenceSource = 'transcript';
      } else if (transcriptHits > 0 && evidenceSource === 'visual_analysis') {
        evidenceSource = 'hybrid';
      }

      rawCandidates.push({
        scene: s as unknown as IScene,
        asset,
        semanticScore: Number(combinedRelevance.toFixed(4)),
        lexicalScore,
        transcriptMatched: transcriptHits > 0,
        matchedKeywords,
        evidenceSource
      });
    }

    // 5. Deduplicate per mediaAssetId? Wait — keep top 2 distinct scenes per asset if timestamps differ, or top 1 for broad search
    rawCandidates.sort((a, b) => b.semanticScore - a.semanticScore);

    const seenAssets = new Set<string>();
    const results: SearchResultItem[] = [];

    for (const c of rawCandidates) {
      const assetIdStr = c.asset._id.toString();
      // Compute multi-factor ranking breakdown via ClipRankingAgent
      const isDuplicateClip = Boolean(c.asset.metadata?.duplicateOfId);
      const diversityBonus = seenAssets.has(assetIdStr) ? 0.35 : 1.0;
      seenAssets.add(assetIdStr);

      const ranking = this.rankingAgent.scoreCandidate({
        semanticRelevance: c.semanticScore,
        visualQuality: c.asset.metadata?.qualityMetrics?.overallScore,
        narrativeValue: c.scene.confidence,
        resolutionWidth: c.asset.width,
        hasAudio: c.asset.metadata?.qualityMetrics?.hasAudio,
        diversityScore: isDuplicateClip ? 0.2 : diversityBonus,
        evidenceSource: c.evidenceSource
      });

      const explanationParts: string[] = [];
      if (c.matchedKeywords.length > 0) {
        explanationParts.push(`Matched terms: ${c.matchedKeywords.join(', ')}`);
      }
      explanationParts.push(`Semantic similarity ${Math.round(c.semanticScore * 100)}%`);
      if (c.evidenceSource === 'metadata') {
        explanationParts.push('Evidence: indexed scene metadata & tags');
      } else if (c.evidenceSource === 'transcript') {
        explanationParts.push('Evidence: audio transcript match');
      } else if (c.evidenceSource === 'visual_analysis') {
        explanationParts.push('Evidence: vision-language frame analysis');
      } else {
        explanationParts.push('Evidence: hybrid visual + transcript');
      }
      if (c.asset.isDemoData) {
        explanationParts.push('DEMO DATA');
      }

      results.push({
        sceneId: c.scene._id.toString(),
        mediaAssetId: assetIdStr,
        filename: c.asset.filename,
        sourceType: c.asset.sourceType,
        mediaType: c.asset.mediaType,
        thumbnailUrl: c.asset.thumbnailReference || `/api/v1/media/${assetIdStr}/thumbnail`,
        playbackUrl: `/api/v1/media/${assetIdStr}/stream`,
        duration: c.asset.duration,
        startTime: c.scene.startTime,
        endTime: c.scene.endTime,
        description: c.scene.description,
        transcript: c.scene.transcript,
        matchScore: Number(ranking.finalScore.toFixed(3)),
        evidenceSource: c.evidenceSource,
        explanation: explanationParts.join(' • '),
        isDemoData: c.asset.isDemoData,
        ranking
      });
    }

    // Final sort by smart ranking score
    results.sort((a, b) => b.matchScore - a.matchScore);

    const startIdx = (input.page - 1) * input.limit;
    const pagedResults = results.slice(startIdx, startIdx + input.limit);

    if (saveToHistory) {
      await SearchHistoryModel.create({
        ownerId: new mongoose.Types.ObjectId(ownerId),
        query: input.query,
        filters: {
          mediaTypes: input.mediaTypes,
          sourceTypes: input.sourceTypes
        },
        resultCount: results.length,
        selectedMediaIds: pagedResults.slice(0, 5).map(r => new mongoose.Types.ObjectId(r.mediaAssetId))
      });
    }

    return {
      results: pagedResults,
      totalMatched: results.length,
      queryEmbeddingModel,
      searchMode: 'hybrid_vector_lexical'
    };
  }
}

