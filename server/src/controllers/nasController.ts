import { Request, Response, NextFunction } from 'express';
import { MediaSourceModel } from '../models/MediaSource';
import { MediaAssetModel } from '../models/MediaAsset';
import { UgreenNasAdapter } from '../adapters/nas/UgreenNasAdapter';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { globalProcessingQueue } from '../queues/ProcessingQueue';
import { BadRequestError } from '../utils/errors';

export async function getNasStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const source = await MediaSourceModel.findOne({
      ownerId: req.user!._id,
      sourceType: 'ugreen_nas'
    }).lean();

    if (!source) {
      res.status(200).json({
        success: true,
        data: {
          connected: false,
          status: 'disconnected',
          provider: 'ugreen_ugos',
          message: 'No UGREEN NAS connection configured yet. You can configure a UGOS host or authorized NAS mount directory, or use isolated Demo Media.',
          configuration: null
        }
      });
      return;
    }

    let apiKey: string | undefined;
    if (source.configuration?.encryptedApiKey) {
      try {
        apiKey = decryptSecret(source.configuration.encryptedApiKey);
      } catch {
        apiKey = undefined;
      }
    }

    const adapter = new UgreenNasAdapter({
      host: source.configuration?.host,
      port: source.configuration?.port,
      useSsl: source.configuration?.useSsl,
      apiKey,
      nasMountPoint: source.configuration?.nasMountPoint,
      shareName: source.configuration?.shareName
    });

    const liveStatus = await adapter.getConnectionStatus();

    if (source.connectionStatus !== liveStatus.status) {
      await MediaSourceModel.findByIdAndUpdate(source._id, {
        connectionStatus: liveStatus.status
      });
    }

    res.status(200).json({
      success: true,
      data: {
        connected: liveStatus.connected,
        status: liveStatus.status,
        provider: source.provider,
        message: liveStatus.message,
        capabilities: liveStatus.capabilities || [],
        lastSyncedAt: source.lastSyncedAt,
        configuration: {
          host: source.configuration?.host,
          port: source.configuration?.port,
          useSsl: source.configuration?.useSsl,
          nasMountPoint: source.configuration?.nasMountPoint,
          shareName: source.configuration?.shareName,
          hasApiKey: Boolean(source.configuration?.encryptedApiKey),
          readOnly: source.permissions?.readOnly ?? true
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function connectNas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { host, port, useSsl, apiKey, nasMountPoint, shareName } = req.body as {
      host?: string;
      port?: number;
      useSsl?: boolean;
      apiKey?: string;
      nasMountPoint?: string;
      shareName?: string;
    };

    if (!host && !nasMountPoint) {
      throw new BadRequestError('Provide either a UGREEN NAS host address or an authorized local UGOS mount directory.');
    }

    const adapter = new UgreenNasAdapter({
      host,
      port: port || 80,
      useSsl: Boolean(useSsl),
      apiKey,
      nasMountPoint,
      shareName
    });

    const status = await adapter.getConnectionStatus();

    const encryptedApiKey = apiKey && apiKey.trim().length > 0 ? encryptSecret(apiKey.trim()) : undefined;

    const existing = await MediaSourceModel.findOne({
      ownerId: req.user!._id,
      sourceType: 'ugreen_nas'
    });

    const configUpdate = {
      host: host || existing?.configuration?.host,
      port: port || existing?.configuration?.port || 80,
      useSsl: useSsl ?? existing?.configuration?.useSsl ?? false,
      nasMountPoint: nasMountPoint ?? existing?.configuration?.nasMountPoint,
      shareName: shareName ?? existing?.configuration?.shareName,
      encryptedApiKey: encryptedApiKey || existing?.configuration?.encryptedApiKey
    };

    const source = await MediaSourceModel.findOneAndUpdate(
      { ownerId: req.user!._id, sourceType: 'ugreen_nas' },
      {
        ownerId: req.user!._id,
        sourceType: 'ugreen_nas',
        provider: 'ugreen_ugos',
        name: shareName || host || 'UGREEN AI NAS',
        connectionStatus: status.status,
        configuration: configUpdate,
        permissions: {
          readOnly: true,
          allowedDirectories: nasMountPoint ? [nasMountPoint] : ['/media']
        }
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      data: {
        id: source._id.toString(),
        connected: status.connected,
        status: status.status,
        message: status.message,
        capabilities: status.capabilities || []
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function syncNas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const source = await MediaSourceModel.findOne({
      ownerId: req.user!._id,
      sourceType: 'ugreen_nas'
    });

    if (!source) {
      throw new BadRequestError('UGREEN NAS is not configured.');
    }

    let apiKey: string | undefined;
    if (source.configuration?.encryptedApiKey) {
      try {
        apiKey = decryptSecret(source.configuration.encryptedApiKey);
      } catch {
        apiKey = undefined;
      }
    }

    const adapter = new UgreenNasAdapter({
      host: source.configuration?.host,
      port: source.configuration?.port,
      useSsl: source.configuration?.useSsl,
      apiKey,
      nasMountPoint: source.configuration?.nasMountPoint,
      shareName: source.configuration?.shareName
    });

    const status = await adapter.getConnectionStatus();
    if (!status.connected) {
      source.connectionStatus = status.status;
      await source.save();
      res.status(200).json({
        success: false,
        data: {
          connected: false,
          status: status.status,
          message: status.message,
          discoveredCount: 0,
          queuedJobs: 0
        }
      });
      return;
    }

    const discovered = await adapter.discoverMedia(req.user!._id.toString());
    let queuedJobs = 0;

    for (const item of discovered) {
      const exists = await MediaAssetModel.findOne({
        ownerId: req.user!._id,
        storageReference: item.storageReference
      });
      if (!exists) {
        const asset = await MediaAssetModel.create({
          ownerId: req.user!._id,
          sourceId: source._id,
          sourceType: 'ugreen_nas',
          filename: item.filename,
          originalFilename: item.originalFilename,
          mimeType: item.mimeType,
          mediaType: item.mediaType,
          storageReference: item.storageReference,
          fileSize: item.fileSize,
          isDemoData: false,
          processingStatus: 'pending',
          metadata: item.metadata || {}
        });
        await globalProcessingQueue.enqueueAssetProcessing(req.user!._id.toString(), asset._id.toString());
        queuedJobs++;
      }
    }

    source.connectionStatus = 'connected';
    source.lastSyncedAt = new Date();
    await source.save();

    res.status(200).json({
      success: true,
      data: {
        connected: true,
        status: 'connected',
        message: `Synced UGREEN NAS: discovered ${discovered.length} authorized files (${queuedJobs} new queued for indexing).`,
        discoveredCount: discovered.length,
        queuedJobs
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function disconnectNas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await MediaSourceModel.findOneAndUpdate(
      { ownerId: req.user!._id, sourceType: 'ugreen_nas' },
      {
        connectionStatus: 'disconnected',
        'configuration.encryptedApiKey': undefined
      }
    );
    res.status(200).json({
      success: true,
      message: 'UGREEN NAS disconnected cleanly (existing media indexes preserved).'
    });
  } catch (error) {
    next(error);
  }
}

