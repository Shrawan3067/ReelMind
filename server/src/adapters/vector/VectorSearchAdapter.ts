import mongoose from 'mongoose';
import { SceneModel, IScene } from '../../models/Scene';
import { cosineSimilarity } from '../ai/LocalDeterministicEmbedding';
import { env } from '../../config/env';

export interface VectorSearchCandidate {
  scene: IScene;
  vectorScore: number;
}

export interface VectorSearchAdapter {
  searchSimilarScenes(
    ownerId: string,
    queryVector: number[],
    options: {
      limit: number;
      mediaAssetIds?: mongoose.Types.ObjectId[];
    }
  ): Promise<VectorSearchCandidate[]>;
}

/**
 * In-process cosine similarity vector search adapter compatible with standard MongoDB
 * and mongodb-memory-server.
 */
export class LocalCosineVectorSearchAdapter implements VectorSearchAdapter {
  public async searchSimilarScenes(
    ownerId: string,
    queryVector: number[],
    options: {
      limit: number;
      mediaAssetIds?: mongoose.Types.ObjectId[];
    }
  ): Promise<VectorSearchCandidate[]> {
    const filter: Record<string, unknown> = {
      ownerId: new mongoose.Types.ObjectId(ownerId)
    };

    if (options.mediaAssetIds && options.mediaAssetIds.length > 0) {
      filter.mediaAssetId = { $in: options.mediaAssetIds };
    }

    const scenes = await SceneModel.find(filter).lean();

    const scored: VectorSearchCandidate[] = [];
    for (const s of scenes) {
      const emb = s.embedding || [];
      const sim = emb.length === queryVector.length && emb.length > 0
        ? cosineSimilarity(queryVector, emb)
        : 0;
      scored.push({
        scene: s as unknown as IScene,
        vectorScore: sim
      });
    }

    scored.sort((a, b) => b.vectorScore - a.vectorScore);
    return scored.slice(0, options.limit);
  }
}

/**
 * MongoDB Atlas Vector Search adapter using $vectorSearch aggregation stage.
 * Automatically falls back to LocalCosineVectorSearchAdapter if Atlas $vectorSearch
 * index is unavailable in the connected MongoDB deployment.
 */
export class AtlasVectorSearchAdapter implements VectorSearchAdapter {
  private readonly fallback = new LocalCosineVectorSearchAdapter();

  public async searchSimilarScenes(
    ownerId: string,
    queryVector: number[],
    options: {
      limit: number;
      mediaAssetIds?: mongoose.Types.ObjectId[];
    }
  ): Promise<VectorSearchCandidate[]> {
    try {
      const filterClause: Record<string, unknown> = {
        ownerId: new mongoose.Types.ObjectId(ownerId)
      };
      if (options.mediaAssetIds && options.mediaAssetIds.length > 0) {
        filterClause.mediaAssetId = { $in: options.mediaAssetIds };
      }

      const docs = await SceneModel.aggregate([
        {
          $vectorSearch: {
            index: env.ATLAS_VECTOR_INDEX,
            path: 'embedding',
            queryVector,
            numCandidates: Math.max(50, options.limit * 5),
            limit: options.limit,
            filter: filterClause
          }
        },
        {
          $addFields: {
            vectorScore: { $meta: 'vectorSearchScore' }
          }
        }
      ]);

      return docs.map(d => ({
        scene: d as unknown as IScene,
        vectorScore: Number(d.vectorScore || 0)
      }));
    } catch {
      return this.fallback.searchSimilarScenes(ownerId, queryVector, options);
    }
  }
}

export function createVectorSearchAdapter(): VectorSearchAdapter {
  return env.VECTOR_SEARCH_MODE === 'atlas'
    ? new AtlasVectorSearchAdapter()
    : new LocalCosineVectorSearchAdapter();
}
