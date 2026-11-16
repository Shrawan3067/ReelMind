import mongoose, { Document, Schema } from 'mongoose';
import { ProcessingStatus } from '@reelmind/shared';

export interface IProcessingJob extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  mediaAssetId: mongoose.Types.ObjectId;
  jobType: 'metadata_extraction' | 'thumbnail_generation' | 'scene_analysis' | 'transcription' | 'full_pipeline';
  status: ProcessingStatus;
  progress: number; // 0 - 100
  stage: string;
  attempts: number;
  maxAttempts: number;
  error?: string;
  logs: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProcessingJobSchema = new Schema<IProcessingJob>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mediaAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', required: true, index: true },
    jobType: {
      type: String,
      enum: ['metadata_extraction', 'thumbnail_generation', 'scene_analysis', 'transcription', 'full_pipeline'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    stage: { type: String, default: 'Created' },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    error: { type: String },
    logs: [{ type: String }],
    startedAt: { type: Date },
    completedAt: { type: Date }
  },
  { timestamps: true }
);

ProcessingJobSchema.index({ ownerId: 1, status: 1 });
ProcessingJobSchema.index({ mediaAssetId: 1, status: 1 });

export const ProcessingJobModel = mongoose.model<IProcessingJob>('ProcessingJob', ProcessingJobSchema);

