import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MediaAssetModel } from '../models/MediaAsset';
import { ProjectModel } from '../models/Project';
import { ProcessingJobModel } from '../models/ProcessingJob';
import { SearchHistoryModel } from '../models/SearchHistory';
import { StoryboardModel } from '../models/Storyboard';
import { MediaSourceModel } from '../models/MediaSource';
import { SceneModel } from '../models/Scene';
import { UserModel } from '../models/User';
import { AIProviderAdapter } from '../adapters/ai/AIProviderAdapter';

export async function getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user!._id);

    const [
      totalMedia,
      videosIndexed,
      photosIndexed,
      audioIndexed,
      demoCount,
      nasCount,
      localCount,
      storageAgg,
      activeJobs,
      failedJobs,
      totalScenes,
      totalStoryboards,
      recentSearches,
      recentStoryboards,
      nasSource,
      user
    ] = await Promise.all([
      MediaAssetModel.countDocuments({ ownerId }),
      MediaAssetModel.countDocuments({ ownerId, mediaType: 'video' }),
      MediaAssetModel.countDocuments({ ownerId, mediaType: 'image' }),
      MediaAssetModel.countDocuments({ ownerId, mediaType: 'audio' }),
      MediaAssetModel.countDocuments({ ownerId, isDemoData: true }),
      MediaAssetModel.countDocuments({ ownerId, sourceType: 'ugreen_nas' }),
      MediaAssetModel.countDocuments({ ownerId, sourceType: 'local_upload' }),
      MediaAssetModel.aggregate([
        { $match: { ownerId } },
        { $group: { _id: null, totalBytes: { $sum: '$fileSize' }, totalDuration: { $sum: '$duration' } } }
      ]),
      ProcessingJobModel.countDocuments({ ownerId, status: { $in: ['pending', 'queued', 'processing'] } }),
      ProcessingJobModel.countDocuments({ ownerId, status: 'failed' }),
      SceneModel.countDocuments({ ownerId }),
      StoryboardModel.countDocuments({ ownerId }),
      SearchHistoryModel.find({ ownerId }).sort({ createdAt: -1 }).limit(6).lean(),
      StoryboardModel.find({ ownerId })
        .sort({ updatedAt: -1 })
        .limit(4)
        .select('title creativeConcept actualDuration targetDuration aspectRatio mood scenes version updatedAt')
        .lean(),
      MediaSourceModel.findOne({ ownerId, sourceType: 'ugreen_nas' }).lean(),
      UserModel.findById(ownerId).select('aiConfig').lean()
    ]);

    const totalBytes = storageAgg[0]?.totalBytes || 0;
    const totalDurationSeconds = storageAgg[0]?.totalDuration || 0;
    const aiCapabilities = AIProviderAdapter.fromUserOrEnv(user?.aiConfig).getCapabilities();

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalMedia,
          videosIndexed,
          photosIndexed,
          audioIndexed,
          demoMediaCount: demoCount,
          nasMediaCount: nasCount,
          localMediaCount: localCount,
          realMediaCount: totalMedia - demoCount,
          totalStorageBytes: totalBytes,
          totalDurationSeconds,
          totalScenesIndexed: totalScenes,
          activeJobs,
          failedJobs,
          totalStoryboards
        },
        aiCapabilities: {
          provider: aiCapabilities.provider,
          configured: aiCapabilities.configured,
          model: aiCapabilities.model,
          visionAvailable: aiCapabilities.visionAvailable
        },
        nasStatus: {
          status: nasSource?.connectionStatus || 'disconnected',
          provider: nasSource?.provider || 'ugreen_ugos',
          host: nasSource?.configuration?.host || null,
          lastSyncedAt: nasSource?.lastSyncedAt || null
        },
        recentStoryboards: recentStoryboards.map(sb => ({
          id: sb._id.toString(),
          title: sb.title,
          creativeConcept: sb.creativeConcept,
          actualDuration: sb.actualDuration,
          targetDuration: sb.targetDuration,
          aspectRatio: sb.aspectRatio,
          mood: sb.mood,
          sceneCount: sb.scenes?.length || 0,
          coverThumbnailUrl: sb.scenes?.[0]?.thumbnailUrl || null,
          hasDemoMedia: sb.scenes?.some(s => s.isDemoData) || false,
          version: sb.version,
          updatedAt: sb.updatedAt
        })),
        recentSearches: recentSearches.map(s => ({
          id: s._id.toString(),
          query: s.query,
          resultCount: s.resultCount,
          createdAt: s.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getRecentProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user!._id);
    const projects = await ProjectModel.find({ ownerId })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate('activeStoryboardId', 'title actualDuration aspectRatio mood scenes')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        projects: projects.map(p => {
          const sb = p.activeStoryboardId as {
            _id: mongoose.Types.ObjectId;
            scenes?: Array<{ thumbnailUrl?: string; isDemoData?: boolean }>;
            actualDuration?: number;
            mood?: string;
          } | null;
          return {
            id: p._id.toString(),
            title: p.title,
            description: p.description,
            prompt: p.prompt,
            targetDuration: p.targetDuration,
            actualDuration: sb?.actualDuration ?? p.targetDuration,
            aspectRatio: p.aspectRatio,
            mood: sb?.mood || 'Cinematic',
            status: p.status,
            storyboardId: sb ? sb._id.toString() : null,
            sceneCount: sb?.scenes?.length || 0,
            coverThumbnailUrl: sb?.scenes?.[0]?.thumbnailUrl || null,
            hasDemoMedia: sb?.scenes?.some(s => s.isDemoData) || false,
            updatedAt: p.updatedAt
          };
        })
      }
    });
  } catch (error) {
    next(error);
  }
}
