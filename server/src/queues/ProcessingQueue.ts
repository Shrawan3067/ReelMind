import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { ProcessingJobModel, IProcessingJob } from '../models/ProcessingJob';
import { MediaAssetModel } from '../models/MediaAsset';
import { SceneModel } from '../models/Scene';
import { UserModel } from '../models/User';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { MediaProbeService } from '../services/media/MediaProbeService';
import { AIProviderAdapter } from '../adapters/ai/AIProviderAdapter';
import { LocalUploadMediaAdapter } from '../adapters/media/LocalUploadMediaAdapter';
import { computeLocalEmbedding } from '../adapters/ai/LocalDeterministicEmbedding';
import { EvidenceSource } from '@reelmind/shared';

export class ProcessingQueue {
  private activeWorkers = 0;
  private readonly maxConcurrent: number;
  private readonly queue: string[] = [];
  private io: SocketIOServer | null = null;
  private readonly probeService = new MediaProbeService();
  private readonly localAdapter = new LocalUploadMediaAdapter();

  constructor(maxConcurrent = env.MAX_CONCURRENT_JOBS) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  public attachSocketServer(io: SocketIOServer): void {
    this.io = io;
  }

  private emitUpdate(ownerId: string, event: string, payload: Record<string, unknown>): void {
    if (this.io) {
      this.io.to(`user:${ownerId}`).emit(event, payload);
    }
  }

  public async enqueueAssetProcessing(
    ownerId: string,
    mediaAssetId: string,
    jobType: IProcessingJob['jobType'] = 'full_pipeline'
  ): Promise<IProcessingJob> {
    // Prevent duplicate active jobs for the same asset
    const existingActive = await ProcessingJobModel.findOne({
      ownerId,
      mediaAssetId,
      status: { $in: ['pending', 'queued', 'processing'] }
    });
    if (existingActive) {
      return existingActive;
    }

    const job = await ProcessingJobModel.create({
      ownerId,
      mediaAssetId,
      jobType,
      status: 'queued',
      progress: 0,
      stage: 'Queued for background analysis',
      attempts: 0,
      maxAttempts: 3,
      logs: [`[${new Date().toISOString()}] Job created (${jobType})`]
    });

    await MediaAssetModel.findByIdAndUpdate(mediaAssetId, { processingStatus: 'queued' });

    this.queue.push(job._id.toString());
    this.emitUpdate(ownerId, 'job:queued', {
      jobId: job._id.toString(),
      mediaAssetId,
      status: 'queued',
      progress: 0
    });

    setImmediate(() => this.drainQueue());
    return job;
  }

  public async retryJob(jobId: string, ownerId: string): Promise<IProcessingJob | null> {
    const job = await ProcessingJobModel.findOne({ _id: jobId, ownerId });
    if (!job) return null;

    job.status = 'queued';
    job.progress = 0;
    job.error = undefined;
    job.stage = 'Re-queued manually';
    job.logs.push(`[${new Date().toISOString()}] Manual retry requested`);
    await job.save();

    await MediaAssetModel.findByIdAndUpdate(job.mediaAssetId, { processingStatus: 'queued' });
    this.queue.push(job._id.toString());
    setImmediate(() => this.drainQueue());
    return job;
  }

  private drainQueue(): void {
    while (this.activeWorkers < this.maxConcurrent && this.queue.length > 0) {
      const jobId = this.queue.shift();
      if (!jobId) break;
      this.activeWorkers++;
      this.runJob(jobId).finally(() => {
        this.activeWorkers--;
        this.drainQueue();
      });
    }
  }

  private async updateProgress(
    job: IProcessingJob,
    progress: number,
    stage: string,
    logMsg?: string
  ): Promise<void> {
    job.progress = progress;
    job.stage = stage;
    if (logMsg) {
      job.logs.push(`[${new Date().toISOString()}] ${logMsg}`);
    }
    await job.save();
    this.emitUpdate(job.ownerId.toString(), 'job:progress', {
      jobId: job._id.toString(),
      mediaAssetId: job.mediaAssetId.toString(),
      status: job.status,
      progress,
      stage
    });
  }

  private async runJob(jobId: string): Promise<void> {
    const job = await ProcessingJobModel.findById(jobId);
    if (!job) return;

    const ownerId = job.ownerId.toString();
    const asset = await MediaAssetModel.findById(job.mediaAssetId);
    if (!asset) {
      job.status = 'failed';
      job.error = 'Associated media asset not found';
      await job.save();
      return;
    }

    try {
      job.status = 'processing';
      job.startedAt = new Date();
      job.attempts += 1;
      await this.updateProgress(job, 10, 'Initializing media pipeline', `Attempt #${job.attempts} started for ${asset.filename}`);
      await MediaAssetModel.findByIdAndUpdate(asset._id, { processingStatus: 'processing' });

      const user = await UserModel.findById(ownerId);
      const aiAdapter = AIProviderAdapter.fromUserOrEnv(user?.aiConfig);
      const aiCaps = aiAdapter.getCapabilities();

      let extractedDuration = asset.duration || 0;
      let extractedWidth = asset.width || 0;
      let extractedHeight = asset.height || 0;
      let sha256Hash = asset.metadata?.sha256Hash;
      let perceptualHash = asset.metadata?.perceptualHash;
      let qualityMetrics = asset.metadata?.qualityMetrics;
      let extractedFrames: Array<{ timestamp: number; base64: string; mimeType: string }> = [];
      let subtitleCues: Array<{ startTime: number; endTime: number; text: string }> = [];
      let transcribedSpeech: string | null = null;

      if (asset.sourceType === 'local_upload') {
        const filePath = this.localAdapter.resolveSafePath(asset.storageReference);
        await this.updateProgress(job, 30, 'Extracting metadata and media fingerprint', `Probing local upload at ${path.basename(filePath)}`);
        const probe = await this.probeService.extractMetadata(filePath, asset.mediaType, asset._id.toString());

        extractedDuration = probe.duration;
        extractedWidth = probe.width;
        extractedHeight = probe.height;
        sha256Hash = probe.sha256Hash;
        perceptualHash = probe.perceptualHash;
        qualityMetrics = probe.qualityMetrics;
        extractedFrames = probe.extractedFramesBase64 || [];

        if (asset.mediaType === 'video') {
          subtitleCues = await this.probeService.extractSubtitlesIfPresent(filePath);
          if (subtitleCues.length > 0) {
            job.logs.push(`[${new Date().toISOString()}] Extracted ${subtitleCues.length} subtitle cues`);
          }
        }
        if ((asset.mediaType === 'audio' || (asset.mediaType === 'video' && probe.hasAudio)) && subtitleCues.length === 0 && aiCaps.configured) {
          transcribedSpeech = await aiAdapter.transcribeAudioFile(filePath, asset.mimeType);
          if (transcribedSpeech) {
            job.logs.push(`[${new Date().toISOString()}] Audio speech-to-text completed via ${aiCaps.provider}`);
          }
        }

        asset.duration = extractedDuration;
        asset.width = extractedWidth;
        asset.height = extractedHeight;
        asset.frameRate = probe.frameRate;
        if (probe.thumbnailPath) {
          asset.thumbnailReference = `/api/v1/media/${asset._id.toString()}/thumbnail`;
        }
        asset.metadata = {
          ...asset.metadata,
          codec: probe.codec,
          bitrate: probe.bitrate,
          sha256Hash,
          perceptualHash,
          qualityMetrics,
          audioTranscript: transcribedSpeech || (subtitleCues.length > 0 ? subtitleCues.map(c => c.text).join(' ') : asset.metadata?.audioTranscript)
        };
      } else {
        await this.updateProgress(job, 35, 'Inspecting indexed asset metadata', `Analyzing ${asset.sourceType} asset (${asset.filename})`);
      }

      // Check duplicate exact SHA-256 against user's existing assets
      if (sha256Hash) {
        const dup = await MediaAssetModel.findOne({
          ownerId: asset.ownerId,
          _id: { $ne: asset._id },
          'metadata.sha256Hash': sha256Hash
        });
        if (dup) {
          asset.metadata.duplicateOfId = dup._id.toString();
          asset.metadata.similarityScore = 1.0;
          job.logs.push(`[${new Date().toISOString()}] Exact SHA-256 duplicate detected matching ${dup.filename}`);
        }
      }

      await this.updateProgress(job, 60, 'Segmenting scenes & running AI understanding');

      // Remove old scenes for clean re-index
      await SceneModel.deleteMany({ mediaAssetId: asset._id, ownerId: asset.ownerId });

      let analysisSource: EvidenceSource = 'metadata';
      let sceneDescription = asset.metadata?.summary || `Media asset ${asset.originalFilename} (${asset.mediaType}, ${extractedWidth}x${extractedHeight})`;
      let detectedObjects: string[] = asset.metadata?.tags || [];
      let detectedActions: string[] = [];

      if (extractedFrames.length > 0 && aiCaps.visionAvailable) {
        const frame = extractedFrames[0];
        const visionRes = await aiAdapter.analyzeImageBase64(frame.base64, frame.mimeType);
        if (visionRes && visionRes.analyzedVisually) {
          analysisSource = 'visual_analysis';
          sceneDescription = visionRes.description;
          detectedObjects = visionRes.objects;
          detectedActions = visionRes.actions;
          job.logs.push(`[${new Date().toISOString()}] Visual understanding completed via ${aiCaps.provider} (${aiCaps.model})`);
        } else {
          job.logs.push(`[${new Date().toISOString()}] Visual provider unavailable or failed; falling back to metadata analysis`);
        }
      } else {
        job.logs.push(`[${new Date().toISOString()}] No vision frame analyzed (${aiCaps.visionAvailable ? 'no extracted frame' : 'vision provider not configured'}); marking evidence as metadata`);
      }

      await this.updateProgress(job, 85, 'Generating semantic embeddings');

      if (subtitleCues.length > 0) {
        for (const cue of subtitleCues) {
          const cueSemantic = `${asset.originalFilename} ${cue.text}`.trim();
          const { vector: cueVec, model: cueModel } = await aiAdapter.generateEmbedding(cueSemantic);
          await SceneModel.create({
            ownerId: asset.ownerId,
            mediaAssetId: asset._id,
            startTime: cue.startTime,
            endTime: cue.endTime,
            description: `Spoken dialogue / subtitle: "${cue.text}"`,
            detectedObjects,
            detectedActions,
            transcript: cue.text,
            semanticRepresentation: cueSemantic,
            embedding: cueVec.length > 0 ? cueVec : computeLocalEmbedding(cueSemantic),
            embeddingModel: cueModel,
            confidence: 0.9,
            analysisSource: 'transcript',
            isDemoData: asset.isDemoData
          });
        }
      } else {
        const effectiveTranscript = transcribedSpeech || asset.metadata?.audioTranscript;
        const effectiveSource: EvidenceSource =
          analysisSource === 'visual_analysis' && effectiveTranscript
            ? 'hybrid'
            : analysisSource === 'visual_analysis'
            ? 'visual_analysis'
            : effectiveTranscript
            ? 'transcript'
            : 'metadata';

        const semanticText = `${asset.originalFilename} ${sceneDescription} ${detectedObjects.join(' ')} ${detectedActions.join(' ')} ${effectiveTranscript || ''}`.trim();
        const { vector, model } = await aiAdapter.generateEmbedding(semanticText);

        const endT = asset.mediaType === 'image' ? 0 : Math.max(1, extractedDuration || 10);

        await SceneModel.create({
          ownerId: asset.ownerId,
          mediaAssetId: asset._id,
          startTime: 0,
          endTime: endT,
          description: sceneDescription,
          detectedObjects,
          detectedActions,
          transcript: effectiveTranscript,
          semanticRepresentation: semanticText,
          embedding: vector.length > 0 ? vector : computeLocalEmbedding(semanticText),
          embeddingModel: model,
          confidence: effectiveSource === 'visual_analysis' || effectiveSource === 'hybrid' ? 0.92 : 0.72,
          analysisSource: effectiveSource,
          isDemoData: asset.isDemoData
        });
      }

      asset.processingStatus = 'completed';
      await asset.save();

      job.status = 'completed';
      job.completedAt = new Date();
      await this.updateProgress(job, 100, 'Completed', 'Pipeline completed successfully');

      this.emitUpdate(ownerId, 'job:completed', {
        jobId: job._id.toString(),
        mediaAssetId: asset._id.toString(),
        status: 'completed',
        progress: 100
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown pipeline error';
      logger.error({ err: error, jobId }, 'Media processing job failed');

      job.status = 'failed';
      job.error = msg;
      job.stage = 'Failed';
      job.logs.push(`[${new Date().toISOString()}] ERROR: ${msg}`);
      await job.save();

      await MediaAssetModel.findByIdAndUpdate(asset._id, {
        processingStatus: 'failed',
        'metadata.error': msg
      });

      this.emitUpdate(ownerId, 'job:failed', {
        jobId: job._id.toString(),
        mediaAssetId: asset._id.toString(),
        status: 'failed',
        error: msg
      });
    }
  }
}

export const globalProcessingQueue = new ProcessingQueue();

