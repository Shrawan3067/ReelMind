import mongoose, { Document, Schema } from 'mongoose';
import { MediaType, ProcessingStatus, QualityMetrics, SourceType } from '@reelmind/shared';

export interface IMediaAsset extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  sourceId?: mongoose.Types.ObjectId;
  sourceType: SourceType;
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType: MediaType;
  storageReference: string;
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  thumbnailReference?: string;
  processingStatus: ProcessingStatus;
  isFavorite: boolean;
  collections: string[];
  isDemoData: boolean;
  metadata: {
    codec?: string;
    bitrate?: number;
    sha256Hash?: string;
    perceptualHash?: string;
    duplicateOfId?: string;
    similarityScore?: number;
    qualityMetrics?: QualityMetrics;
    tags?: string[];
    summary?: string;
    audioTranscript?: string;
    error?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MediaAssetSchema = new Schema<IMediaAsset>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, ref: 'MediaSource' },
    sourceType: { type: String, enum: ['ugreen_nas', 'local_upload', 'demo'], required: true, index: true },
    filename: { type: String, required: true, trim: true },
    originalFilename: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    mediaType: { type: String, enum: ['video', 'image', 'audio'], required: true, index: true },
    storageReference: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 0 },
    duration: { type: Number, default: 0, min: 0 },
    width: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    frameRate: { type: Number, default: 0, min: 0 },
    thumbnailReference: { type: String },
    processingStatus: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    isFavorite: { type: Boolean, default: false, index: true },
    collections: [{ type: String, trim: true }],
    isDemoData: { type: Boolean, default: false, index: true },
    metadata: {
      codec: { type: String },
      bitrate: { type: Number },
      sha256Hash: { type: String, index: true },
      perceptualHash: { type: String, index: true },
      duplicateOfId: { type: String },
      similarityScore: { type: Number },
      qualityMetrics: { type: Schema.Types.Mixed },
      tags: [{ type: String }],
      summary: { type: String },
      audioTranscript: { type: String },
      error: { type: String }
    }
  },
  { timestamps: true }
);

MediaAssetSchema.index({ ownerId: 1, createdAt: -1 });
MediaAssetSchema.index({ ownerId: 1, mediaType: 1, sourceType: 1 });
MediaAssetSchema.index({ filename: 'text', 'metadata.tags': 'text', 'metadata.summary': 'text', 'metadata.audioTranscript': 'text' });

export const MediaAssetModel = mongoose.model<IMediaAsset>('MediaAsset', MediaAssetSchema);

