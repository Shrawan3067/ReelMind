import mongoose from 'mongoose';
import { MediaAssetModel } from '../../models/MediaAsset';

export interface DuplicateGroup {
  matchType: 'exact_sha256' | 'perceptual_similarity';
  hashKey: string;
  potentialSavingsBytes: number;
  assets: Array<{
    id: string;
    filename: string;
    sourceType: string;
    fileSize: number;
    duration: number;
    width: number;
    height: number;
    isDemoData: boolean;
  }>;
}

export interface QualityAuditReport {
  totalScanned: number;
  exactDuplicateGroups: DuplicateGroup[];
  similarClipGroups: DuplicateGroup[];
  lowQualityClips: Array<{
    id: string;
    filename: string;
    resolution: string;
    reason: string;
    fileSize: number;
    isDemoData: boolean;
  }>;
  unusableClips: Array<{
    id: string;
    filename: string;
    reason: string;
    isDemoData: boolean;
  }>;
  potentialStorageSavingsBytes: number;
}

export class DuplicateQualityService {
  public async generateQualityReport(ownerId: string): Promise<QualityAuditReport> {
    const assets = await MediaAssetModel.find({
      ownerId: new mongoose.Types.ObjectId(ownerId)
    }).lean();

    const shaGroups = new Map<string, typeof assets>();
    const pHashGroups = new Map<string, typeof assets>();
    const lowQualityClips: QualityAuditReport['lowQualityClips'] = [];
    const unusableClips: QualityAuditReport['unusableClips'] = [];

    for (const asset of assets) {
      if (asset.metadata?.sha256Hash) {
        const list = shaGroups.get(asset.metadata.sha256Hash) || [];
        list.push(asset);
        shaGroups.set(asset.metadata.sha256Hash, list);
      }

      if (asset.metadata?.perceptualHash) {
        const list = pHashGroups.get(asset.metadata.perceptualHash) || [];
        list.push(asset);
        pHashGroups.set(asset.metadata.perceptualHash, list);
      }

      const q = asset.metadata?.qualityMetrics;
      if (q?.corrupted || asset.processingStatus === 'failed') {
        unusableClips.push({
          id: asset._id.toString(),
          filename: asset.filename,
          reason: q?.notes || asset.metadata?.error || 'Corrupted or failed processing',
          isDemoData: asset.isDemoData
        });
      } else if (
        asset.mediaType === 'video' &&
        asset.width > 0 &&
        asset.width < 1280
      ) {
        lowQualityClips.push({
          id: asset._id.toString(),
          filename: asset.filename,
          resolution: `${asset.width}x${asset.height}`,
          reason: `Sub-HD resolution (${asset.width}x${asset.height})`,
          fileSize: asset.fileSize,
          isDemoData: asset.isDemoData
        });
      }
    }

    let potentialStorageSavingsBytes = 0;
    const exactDuplicateGroups: DuplicateGroup[] = [];
    for (const [hash, group] of shaGroups.entries()) {
      if (group.length > 1) {
        const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const savings = sorted.slice(1).reduce((sum, item) => sum + item.fileSize, 0);
        potentialStorageSavingsBytes += savings;
        exactDuplicateGroups.push({
          matchType: 'exact_sha256',
          hashKey: hash,
          potentialSavingsBytes: savings,
          assets: sorted.map(a => ({
            id: a._id.toString(),
            filename: a.filename,
            sourceType: a.sourceType,
            fileSize: a.fileSize,
            duration: a.duration,
            width: a.width,
            height: a.height,
            isDemoData: a.isDemoData
          }))
        });
      }
    }

    const similarClipGroups: DuplicateGroup[] = [];
    for (const [pHash, group] of pHashGroups.entries()) {
      if (group.length > 1) {
        // Avoid duplicating items already flagged as exact SHA matches
        const distinctHashes = new Set(group.map(g => g.metadata?.sha256Hash).filter(Boolean));
        if (distinctHashes.size > 1 || distinctHashes.size === 0) {
          const savings = group.slice(1).reduce((sum, item) => sum + item.fileSize, 0);
          potentialStorageSavingsBytes += savings;
          similarClipGroups.push({
            matchType: 'perceptual_similarity',
            hashKey: pHash,
            potentialSavingsBytes: savings,
            assets: group.map(a => ({
              id: a._id.toString(),
              filename: a.filename,
              sourceType: a.sourceType,
              fileSize: a.fileSize,
              duration: a.duration,
              width: a.width,
              height: a.height,
              isDemoData: a.isDemoData
            }))
          });
        }
      }
    }

    return {
      totalScanned: assets.length,
      exactDuplicateGroups,
      similarClipGroups,
      lowQualityClips,
      unusableClips,
      potentialStorageSavingsBytes
    };
  }
}

