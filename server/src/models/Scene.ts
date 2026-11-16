import mongoose, { Document, Schema } from 'mongoose';
import { EvidenceSource } from '@reelmind/shared';

export interface IScene extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  mediaAssetId: mongoose.Types.ObjectId;
  startTime: number;
  endTime: number;
  description: string;
  detectedObjects: string[];
  detectedActions: string[];
  transcript?: string;
  semanticRepresentation: string;
  embedding: number[];
  embeddingModel: string;
  confidence: number;
  analysisSource: EvidenceSource;
  isDemoData: boolean;
  createdAt: Date;
}

const SceneSchema = new Schema<IScene>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mediaAssetId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', required: true, index: true },
    startTime: { type: Number, required: true, min: 0 },
    endTime: { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
    detectedObjects: [{ type: String }],
    detectedActions: [{ type: String }],
    transcript: { type: String },
    semanticRepresentation: { type: String, required: true },
    embedding: [{ type: Number }],
    embeddingModel: { type: String, default: 'local-tfidf-hash' },
    confidence: { type: Number, default: 0.75, min: 0, max: 1 },
    analysisSource: {
      type: String,
      enum: ['visual_analysis', 'transcript', 'metadata', 'hybrid'],
      required: true,
      default: 'metadata'
    },
    isDemoData: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SceneSchema.index({ ownerId: 1, mediaAssetId: 1 });
SceneSchema.index({ description: 'text', transcript: 'text', semanticRepresentation: 'text' });

export const SceneModel = mongoose.model<IScene>('Scene', SceneSchema);

