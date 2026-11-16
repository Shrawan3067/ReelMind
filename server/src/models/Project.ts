import mongoose, { Document, Schema } from 'mongoose';
import { AspectRatio } from '@reelmind/shared';

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  prompt: string;
  targetDuration: number;
  aspectRatio: AspectRatio;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  selectedMedia: mongoose.Types.ObjectId[];
  activeStoryboardId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '' },
    prompt: { type: String, required: true },
    targetDuration: { type: Number, default: 30, min: 5, max: 600 },
    aspectRatio: { type: String, enum: ['16:9', '9:16', '1:1', '4:5'], default: '16:9' },
    status: { type: String, enum: ['draft', 'in_progress', 'completed', 'archived'], default: 'draft', index: true },
    selectedMedia: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
    activeStoryboardId: { type: Schema.Types.ObjectId, ref: 'Storyboard' }
  },
  { timestamps: true }
);

ProjectSchema.index({ ownerId: 1, createdAt: -1 });

export const ProjectModel = mongoose.model<IProject>('Project', ProjectSchema);

