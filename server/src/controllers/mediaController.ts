import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { MediaAssetModel } from '../models/MediaAsset';
import { SceneModel } from '../models/Scene';
import { CollectionModel } from '../models/Collection';
import { LocalUploadMediaAdapter } from '../adapters/media/LocalUploadMediaAdapter';
import { DemoMediaAdapter } from '../adapters/media/DemoMediaAdapter';
import { inferMediaTypeFromMime } from '../adapters/media/MediaSourceAdapter';
import { globalProcessingQueue } from '../queues/ProcessingQueue';
import { DemoSeedService } from '../services/media/DemoSeedService';
import { DuplicateQualityService } from '../services/media/DuplicateQualityService';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { env } from '../config/env';

const localAdapter = new LocalUploadMediaAdapter();
const demoAdapter = new DemoMediaAdapter();
const demoSeedService = new DemoSeedService();
const duplicateQualityService = new DuplicateQualityService();

export async function listMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user!._id);
    const {
      page = '1',
      limit = '24',
      cursor,
      mediaType,
      sourceType,
      search,
      minDuration,
      maxDuration,
      minWidth,
      favorite,
      collection,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));

    const baseFilter: Record<string, unknown> = { ownerId };

    if (mediaType && ['video', 'image', 'audio'].includes(mediaType)) {
      baseFilter.mediaType = mediaType;
    }
    if (sourceType && ['ugreen_nas', 'local_upload', 'demo'].includes(sourceType)) {
      baseFilter.sourceType = sourceType;
    }
    if (favorite === 'true') {
      baseFilter.isFavorite = true;
    }
    if (collection) {
      baseFilter.collections = collection;
    }
    if (minDuration || maxDuration) {
      const dur: Record<string, number> = {};
      if (minDuration) dur.$gte = Number(minDuration);
      if (maxDuration) dur.$lte = Number(maxDuration);
      baseFilter.duration = dur;
    }
    if (minWidth) {
      baseFilter.width = { $gte: Number(minWidth) };
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      baseFilter.$or = [
        { filename: regex },
        { originalFilename: regex },
        { 'metadata.tags': regex },
        { 'metadata.summary': regex }
      ];
    }

    const allowedSortFields: Record<string, string> = {
      createdAt: 'createdAt',
      duration: 'duration',
      fileSize: 'fileSize',
      name: 'filename'
    };
    const sortField = allowedSortFields[sortBy] || 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const queryFilter: Record<string, unknown> = { ...baseFilter };
    let usingCursor = false;
    if (cursor && cursor.includes('_')) {
      const [tsStr, idStr] = cursor.split('_');
      const tsNum = Number(tsStr);
      if (!Number.isNaN(tsNum) && mongoose.Types.ObjectId.isValid(idStr)) {
        usingCursor = true;
        const op = sortDir === 1 ? '$gt' : '$lt';
        const cursorDate = new Date(tsNum);
        const cursorObjId = new mongoose.Types.ObjectId(idStr);
        queryFilter.$and = [
          {
            $or: [
              { createdAt: { [op]: cursorDate } },
              { createdAt: cursorDate, _id: { [op]: cursorObjId } }
            ]
          }
        ];
      }
    }

    const [items, total] = await Promise.all([
      MediaAssetModel.find(queryFilter)
        .sort({ [sortField]: sortDir, _id: sortDir })
        .skip(usingCursor ? 0 : (pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      MediaAssetModel.countDocuments(baseFilter)
    ]);

    const lastItem = items[items.length - 1];
    const nextCursor =
      items.length === limitNum && lastItem
        ? `${new Date(lastItem.createdAt).getTime()}_${lastItem._id.toString()}`
        : null;

    res.status(200).json({
      success: true,
      data: {
        items: items.map(item => ({
          ...item,
          id: item._id.toString(),
          thumbnailUrl: item.thumbnailReference || `/api/v1/media/${item._id.toString()}/thumbnail`,
          playbackUrl: `/api/v1/media/${item._id.toString()}/stream`
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          nextCursor
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getMediaById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asset = await MediaAssetModel.findOne({
      _id: req.params.id,
      ownerId: req.user!._id
    }).lean();

    if (!asset) {
      throw new NotFoundError('Media asset not found');
    }

    const scenes = await SceneModel.find({
      mediaAssetId: asset._id,
      ownerId: req.user!._id
    })
      .select('-embedding')
      .sort({ startTime: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        asset: {
          ...asset,
          id: asset._id.toString(),
          thumbnailUrl: asset.thumbnailReference || `/api/v1/media/${asset._id.toString()}/thumbnail`,
          playbackUrl: `/api/v1/media/${asset._id.toString()}/stream`
        },
        scenes: scenes.map(s => ({ ...s, id: s._id.toString() }))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file;
    const uploadedList = files && files.length > 0 ? files : singleFile ? [singleFile] : [];

    if (uploadedList.length === 0) {
      throw new BadRequestError('No valid media files provided');
    }

    const ownerId = req.user!._id.toString();
    const createdAssets = [];
    const jobs = [];

    for (const file of uploadedList) {
      const mediaType = inferMediaTypeFromMime(file.mimetype);
      if (!mediaType) {
        if (fs.existsSync(file.path)) await fs.promises.unlink(file.path);
        throw new BadRequestError(`Unsupported file type: ${file.mimetype}`);
      }

      const relStorageRef = path.relative(path.resolve(env.UPLOAD_DIRECTORY), file.path);

      const asset = await MediaAssetModel.create({
        ownerId: req.user!._id,
        sourceType: 'local_upload',
        filename: file.originalname,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        mediaType,
        storageReference: relStorageRef,
        fileSize: file.size,
        duration: 0,
        width: 0,
        height: 0,
        frameRate: 0,
        processingStatus: 'pending',
        isDemoData: false,
        metadata: {
          tags: [mediaType, 'uploaded']
        }
      });

      asset.thumbnailReference = `/api/v1/media/${asset._id.toString()}/thumbnail`;
      await asset.save();

      const job = await globalProcessingQueue.enqueueAssetProcessing(ownerId, asset._id.toString(), 'full_pipeline');
      createdAssets.push({ ...asset.toObject(), id: asset._id.toString() });
      jobs.push({ id: job._id.toString(), mediaAssetId: asset._id.toString(), status: job.status });
    }

    res.status(201).json({
      success: true,
      data: {
        assets: createdAssets,
        jobs
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const confirm = req.query.confirm === 'true';
    const asset = await MediaAssetModel.findOne({
      _id: req.params.id,
      ownerId: req.user!._id
    });

    if (!asset) {
      throw new NotFoundError('Media asset not found');
    }

    if (!confirm) {
      throw new BadRequestError('Explicit confirmation (?confirm=true) is required before removing media.');
    }

    // Never automatically delete original NAS media files on disk
    if (asset.sourceType === 'local_upload') {
      try {
        const safePath = localAdapter.resolveSafePath(asset.storageReference);
        if (fs.existsSync(safePath)) {
          await fs.promises.unlink(safePath);
        }
      } catch {
        // Ignore cleanup failure if missing
      }
    }

    await SceneModel.deleteMany({ mediaAssetId: asset._id, ownerId: req.user!._id });
    await asset.deleteOne();

    res.status(200).json({
      success: true,
      message: asset.sourceType === 'ugreen_nas'
        ? 'Removed NAS media reference from ReelMind index (original NAS file preserved).'
        : 'Media asset removed successfully.'
    });
  } catch (error) {
    next(error);
  }
}

export async function analyzeMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asset = await MediaAssetModel.findOne({
      _id: req.params.id,
      ownerId: req.user!._id
    });
    if (!asset) {
      throw new NotFoundError('Media asset not found');
    }

    const job = await globalProcessingQueue.enqueueAssetProcessing(
      req.user!._id.toString(),
      asset._id.toString(),
      'full_pipeline'
    );

    res.status(202).json({
      success: true,
      data: {
        jobId: job._id.toString(),
        status: job.status
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getMediaScenes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asset = await MediaAssetModel.findOne({
      _id: req.params.id,
      ownerId: req.user!._id
    });
    if (!asset) {
      throw new NotFoundError('Media asset not found');
    }

    const scenes = await SceneModel.find({
      mediaAssetId: asset._id,
      ownerId: req.user!._id
    })
      .select('-embedding')
      .sort({ startTime: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: { scenes: scenes.map(s => ({ ...s, id: s._id.toString() })) }
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleFavorite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asset = await MediaAssetModel.findOne({
      _id: req.params.id,
      ownerId: req.user!._id
    });
    if (!asset) {
      throw new NotFoundError('Media asset not found');
    }
    asset.isFavorite = !asset.isFavorite;
    await asset.save();
    res.status(200).json({
      success: true,
      data: { id: asset._id.toString(), isFavorite: asset.isFavorite }
    });
  } catch (error) {
    next(error);
  }
}

export async function serveThumbnail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asset = await MediaAssetModel.findOne({ _id: req.params.id, ownerId: req.user!._id }).lean();
    if (!asset) {
      throw new NotFoundError('Thumbnail not found');
    }

    // Check extracted thumbnail on disk
    const jpgThumb = path.join(env.THUMBNAIL_DIRECTORY, `${asset._id.toString()}.jpg`);
    if (fs.existsSync(jpgThumb)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(jpgThumb).pipe(res);
      return;
    }

    // If image upload, serve the image itself safely
    if (asset.sourceType === 'local_upload' && asset.mediaType === 'image') {
      try {
        const imgPath = localAdapter.resolveSafePath(asset.storageReference);
        if (fs.existsSync(imgPath)) {
          res.setHeader('Content-Type', asset.mimeType);
          fs.createReadStream(imgPath).pipe(res);
          return;
        }
      } catch {
        // Fallback below
      }
    }

    // Render crisp SVG card thumbnail (clearly marked DEMO DATA if demo)
    const color = (asset.metadata as { themeColor?: string } | undefined)?.themeColor || '#3B82F6';
    const categoryLabel = asset.isDemoData
      ? (asset.metadata?.tags?.[0] || 'Demo Asset')
      : asset.mediaType.toUpperCase();

    if (asset.isDemoData) {
      const svg = demoAdapter.renderDemoThumbnailSvg(
        asset.filename,
        categoryLabel,
        color,
        asset.duration || 0
      );
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(svg);
      return;
    }

    // Standard fallback SVG for un-thumbnailed local video/audio
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#11151D"/>
      <rect x="24" y="24" width="110" height="24" rx="6" fill="#3B82F6" fill-opacity="0.2" stroke="#3B82F6"/>
      <text x="79" y="40" font-family="'Poppins', sans-serif" font-size="11" font-weight="600" fill="#E2E8F0" text-anchor="middle">${asset.mediaType.toUpperCase()}</text>
      <text x="320" y="185" font-family="'Poppins', sans-serif" font-size="18" font-weight="600" fill="#F8FAFC" text-anchor="middle">${asset.filename.replace(/[<>&]/g, '')}</text>
      <text x="320" y="215" font-family="'Poppins', sans-serif" font-size="13" fill="#94A3B8" text-anchor="middle">${asset.width || 0}x${asset.height || 0} • ${asset.duration || 0}s</text>
    </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(fallbackSvg);
  } catch (error) {
    next(error);
  }
}

export async function streamMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asset = await MediaAssetModel.findOne({ _id: req.params.id, ownerId: req.user!._id }).lean();
    if (!asset) {
      throw new NotFoundError('Media stream not found');
    }

    if (asset.sourceType === 'local_upload') {
      const filePath = localAdapter.resolveSafePath(asset.storageReference);
      if (!fs.existsSync(filePath)) {
        throw new NotFoundError('Media file missing from disk');
      }

      const stat = await fs.promises.stat(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': asset.mimeType
        });
        file.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': asset.mimeType
        });
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }

    // For demo assets, return structured JSON metadata indicating demo preview mode
    res.status(200).json({
      success: true,
      isDemoData: true,
      message: 'DEMO DATA stream descriptor: UI uses synchronized animated scene preview player for synthetic demo assets.',
      asset: {
        id: asset._id.toString(),
        filename: asset.filename,
        duration: asset.duration,
        mimeType: asset.mimeType,
        summary: asset.metadata?.summary
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function seedDemoMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await demoSeedService.seedDemoLibraryForUser(req.user!._id.toString());
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function clearDemoMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const removedCount = await demoSeedService.clearDemoLibraryForUser(req.user!._id.toString());
    res.status(200).json({
      success: true,
      data: { removedCount }
    });
  } catch (error) {
    next(error);
  }
}

export async function getQualityReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await duplicateQualityService.generateQualityReport(req.user!._id.toString());
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
}

export async function listCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const collections = await CollectionModel.find({ ownerId: req.user!._id }).sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      data: {
        collections: collections.map(c => ({
          id: c._id.toString(),
          name: c.name,
          description: c.description,
          color: c.color,
          mediaCount: c.mediaAssetIds.length,
          createdAt: c.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description, color, mediaAssetIds } = req.body as {
      name: string;
      description?: string;
      color?: string;
      mediaAssetIds?: string[];
    };
    if (!name || name.trim().length === 0) {
      throw new BadRequestError('Collection name is required');
    }

    const col = await CollectionModel.create({
      ownerId: req.user!._id,
      name: name.trim(),
      description,
      color: color || '#3B82F6',
      mediaAssetIds: (mediaAssetIds || []).map(id => new mongoose.Types.ObjectId(id))
    });

    if (mediaAssetIds && mediaAssetIds.length > 0) {
      await MediaAssetModel.updateMany(
        { _id: { $in: mediaAssetIds }, ownerId: req.user!._id },
        { $addToSet: { collections: col.name } }
      );
    }

    res.status(201).json({
      success: true,
      data: {
        id: col._id.toString(),
        name: col.name,
        description: col.description,
        color: col.color
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAssetCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { collections } = req.body as { collections: string[] };
    if (!Array.isArray(collections)) {
      throw new BadRequestError('collections must be an array of collection names');
    }

    const asset = await MediaAssetModel.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user!._id },
      { $set: { collections: collections.map(c => c.trim()).filter(Boolean) } },
      { new: true }
    );

    if (!asset) {
      throw new NotFoundError('Media asset not found');
    }

    res.status(200).json({
      success: true,
      data: { id: asset._id.toString(), collections: asset.collections }
    });
  } catch (error) {
    next(error);
  }
}
