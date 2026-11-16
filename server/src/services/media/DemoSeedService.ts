import mongoose from 'mongoose';
import { DemoMediaAdapter } from '../../adapters/media/DemoMediaAdapter';
import { MediaAssetModel } from '../../models/MediaAsset';
import { SceneModel } from '../../models/Scene';
import { MediaSourceModel } from '../../models/MediaSource';
import { CollectionModel } from '../../models/Collection';
import { computeLocalEmbedding } from '../../adapters/ai/LocalDeterministicEmbedding';

export class DemoSeedService {
  private readonly demoAdapter = new DemoMediaAdapter();

  public async seedDemoLibraryForUser(ownerId: string): Promise<{
    assetsCreated: number;
    scenesCreated: number;
    alreadySeeded: boolean;
  }> {
    const ownerObjId = new mongoose.Types.ObjectId(ownerId);

    // Prevent duplicate seeding if already present
    const existingDemoCount = await MediaAssetModel.countDocuments({
      ownerId: ownerObjId,
      isDemoData: true
    });
    if (existingDemoCount >= 150) {
      return { assetsCreated: 0, scenesCreated: 0, alreadySeeded: true };
    }

    // Remove partial demo records first for clean state
    await MediaAssetModel.deleteMany({ ownerId: ownerObjId, isDemoData: true });
    await SceneModel.deleteMany({ ownerId: ownerObjId, isDemoData: true });

    // Ensure demo MediaSource record exists
    const demoSource = await MediaSourceModel.findOneAndUpdate(
      { ownerId: ownerObjId, sourceType: 'demo' },
      {
        ownerId: ownerObjId,
        sourceType: 'demo',
        provider: 'reelmind_demo_catalog',
        name: 'Isolated Demo Library (DEMO DATA)',
        connectionStatus: 'connected',
        permissions: { readOnly: true, allowedDirectories: ['demo://'] },
        lastSyncedAt: new Date()
      },
      { upsert: true, new: true }
    );

    const blueprints = this.demoAdapter.getDemoDatasetBlueprints();
    let assetsCreated = 0;
    let scenesCreated = 0;

    // Insert MediaAssets in batch with staggered createdAt so signature clips appear first
    const baseNow = Date.now() - 1000;
    const assetDocs = blueprints.map((bp, index) => {
      // Create 2 intentional duplicate fingerprints on sample #45 and #46 so Duplicate Detector demonstrates real matches
      const isSampleDup = index === 45 || index === 46;
      const isPerceptualSim = index === 52 || index === 53;
      const isLowRes = bp.width > 0 && bp.width < 1280;
      const staggeredDate = new Date(baseNow - index * 60_000);

      return {
        ownerId: ownerObjId,
        sourceId: demoSource._id,
        sourceType: 'demo' as const,
        filename: bp.filename,
        originalFilename: bp.originalFilename,
        mimeType: bp.mimeType,
        mediaType: bp.mediaType,
        storageReference: bp.storageReference,
        fileSize: bp.fileSize,
        duration: bp.duration,
        width: bp.width,
        height: bp.height,
        frameRate: bp.frameRate,
        processingStatus: 'completed' as const,
        isFavorite: index < 5,
        collections:
          index < 6
            ? ['Dog Pool Clips']
            : index < 11
            ? ['Travel Montage']
            : index < 14
            ? ['Product Ad']
            : [],
        isDemoData: true,
        createdAt: staggeredDate,
        updatedAt: staggeredDate,
        metadata: {
          codec: bp.mediaType === 'video' ? 'h264' : undefined,
          bitrate: bp.mediaType === 'video' ? Math.round((bp.fileSize * 8) / Math.max(1, bp.duration)) : undefined,
          sha256Hash: isSampleDup ? 'demo_sha256_duplicate_group_alpha' : `demo_sha_${index}_${bp.filename}`,
          perceptualHash: isPerceptualSim ? 'demo_phash_sim_beta' : `demo_phash_${index}`,
          tags: bp.tags,
          summary: bp.summary,
          themeColor: bp.themeColor,
          qualityMetrics: {
            resolutionScore: bp.width >= 3840 ? 1.0 : bp.width >= 1920 ? 0.9 : 0.45,
            hasAudio: bp.mediaType === 'video',
            corrupted: false,
            overallScore: isLowRes ? 0.48 : 0.94,
            notes: 'DEMO DATA synthetic quality profile'
          }
        }
      };
    });

    const insertedAssets = await MediaAssetModel.insertMany(assetDocs);
    assetsCreated = insertedAssets.length;

    // Update thumbnailReference with real inserted ID
    const bulkThumbUpdates = insertedAssets.map(doc => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { thumbnailReference: `/api/v1/media/${doc._id.toString()}/thumbnail` } }
      }
    }));
    await MediaAssetModel.bulkWrite(bulkThumbUpdates);

    // Create Scene documents with embeddings
    const sceneDocs: Array<Record<string, unknown>> = [];
    for (let i = 0; i < insertedAssets.length; i++) {
      const assetDoc = insertedAssets[i];
      const bp = blueprints[i];

      for (const s of bp.scenes) {
        const semanticText = `${bp.filename} ${s.description} ${s.detectedObjects.join(' ')} ${s.detectedActions.join(' ')} ${s.transcript || ''} ${bp.tags.join(' ')}`.trim();
        sceneDocs.push({
          ownerId: ownerObjId,
          mediaAssetId: assetDoc._id,
          startTime: s.startTime,
          endTime: s.endTime,
          description: s.description,
          detectedObjects: s.detectedObjects,
          detectedActions: s.detectedActions,
          transcript: s.transcript,
          semanticRepresentation: semanticText,
          embedding: computeLocalEmbedding(semanticText),
          embeddingModel: 'local-tfidf-hash',
          confidence: s.confidence,
          analysisSource: s.transcript ? 'hybrid' : 'metadata',
          isDemoData: true
        });
      }
    }

    if (sceneDocs.length > 0) {
      await SceneModel.insertMany(sceneDocs);
      scenesCreated = sceneDocs.length;
    }

    // Create default Collections matching demo scenarios
    const defaultCols = [
      { name: 'Dog Pool Clips', color: '#06B6D4', ids: insertedAssets.slice(0, 6).map(a => a._id) },
      { name: 'Travel Montage', color: '#F59E0B', ids: insertedAssets.slice(6, 11).map(a => a._id) },
      { name: 'Product Ad', color: '#3B82F6', ids: insertedAssets.slice(11, 14).map(a => a._id) }
    ];
    for (const c of defaultCols) {
      await CollectionModel.findOneAndUpdate(
        { ownerId: ownerObjId, name: c.name },
        { ownerId: ownerObjId, name: c.name, color: c.color, mediaAssetIds: c.ids },
        { upsert: true }
      );
    }

    return {
      assetsCreated,
      scenesCreated,
      alreadySeeded: false
    };
  }

  public async clearDemoLibraryForUser(ownerId: string): Promise<number> {
    const ownerObjId = new mongoose.Types.ObjectId(ownerId);
    await SceneModel.deleteMany({ ownerId: ownerObjId, isDemoData: true });
    const res = await MediaAssetModel.deleteMany({ ownerId: ownerObjId, isDemoData: true });
    return res.deletedCount || 0;
  }
}

