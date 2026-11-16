import { Request, Response, NextFunction } from 'express';
import { ProcessingJobModel } from '../models/ProcessingJob';
import { globalProcessingQueue } from '../queues/ProcessingQueue';
import { NotFoundError } from '../utils/errors';

export async function listJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query.status as string | undefined;
    const filter: Record<string, unknown> = { ownerId: req.user!._id };
    if (status && ['pending', 'queued', 'processing', 'completed', 'failed'].includes(status)) {
      filter.status = status;
    }

    const jobs = await ProcessingJobModel.find(filter)
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate('mediaAssetId', 'filename mediaType sourceType fileSize isDemoData')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        jobs: jobs.map(j => ({
          id: j._id.toString(),
          mediaAsset: j.mediaAssetId,
          jobType: j.jobType,
          status: j.status,
          progress: j.progress,
          stage: j.stage,
          attempts: j.attempts,
          maxAttempts: j.maxAttempts,
          error: j.error,
          logs: j.logs,
          startedAt: j.startedAt,
          completedAt: j.completedAt,
          createdAt: j.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getJobById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await ProcessingJobModel.findOne({
      _id: req.params.id,
      ownerId: req.user!._id
    })
      .populate('mediaAssetId', 'filename mediaType sourceType fileSize')
      .lean();

    if (!job) {
      throw new NotFoundError('Processing job not found');
    }

    res.status(200).json({
      success: true,
      data: { job: { ...job, id: job._id.toString() } }
    });
  } catch (error) {
    next(error);
  }
}

export async function retryJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await globalProcessingQueue.retryJob(String(req.params.id), req.user!._id.toString());
    if (!job) {
      throw new NotFoundError('Processing job not found');
    }

    res.status(200).json({
      success: true,
      data: { job: { ...job.toObject(), id: job._id.toString() } }
    });
  } catch (error) {
    next(error);
  }
}
