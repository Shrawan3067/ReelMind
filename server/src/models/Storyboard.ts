import mongoose, { Document, Schema } from 'mongoose';
import { StoryboardData } from '@reelmind/shared';

export interface IStoryboard extends Document, Omit<StoryboardData, 'id' | 'projectId'> {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StoryboardSceneMongooseSchema = new Schema(
  {
    id: { type: String, required: true },
    order: { type: Number, required: true },
    mediaAssetId: { type: String, required: true },
    sourceFilename: { type: String, required: true },
    sourceType: { type: String, enum: ['ugreen_nas', 'local_upload', 'demo'], required: true },
    isDemoData: { type: Boolean, default: false },
    sourceDuration: { type: Number, required: true },
    sourceStartTime: { type: Number, required: true },
    sourceEndTime: { type: Number, required: true },
    timelineStartTime: { type: Number, required: true },
    timelineEndTime: { type: Number, required: true },
    description: { type: String, required: true },
    caption: { type: String, default: '' },
    transition: { type: String, enum: ['cut', 'fade_in', 'fade_out', 'crossfade', 'dissolve', 'wipe'], default: 'cut' },
    editingNotes: { type: String },
    locked: { type: Boolean, default: false },
    thumbnailUrl: { type: String },
    playbackUrl: { type: String },
    evidenceSource: { type: String, enum: ['visual_analysis', 'transcript', 'metadata', 'hybrid'], default: 'metadata' }
  },
  { _id: false }
);

const StoryboardSchema = new Schema<IStoryboard>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    creativeConcept: { type: String, required: true },
    targetDuration: { type: Number, required: true },
    actualDuration: { type: Number, required: true },
    aspectRatio: { type: String, enum: ['16:9', '9:16', '1:1', '4:5'], required: true },
    mood: { type: String, required: true },
    scenes: [StoryboardSceneMongooseSchema],
    musicSuggestions: [
      {
        title: { type: String, required: true },
        mood: { type: String, required: true },
        tempo: { type: String, required: true },
        notes: { type: String, required: true }
      }
    ],
    editingNotes: { type: String, default: '' },
    version: { type: Number, default: 1 }
  },
  { timestamps: true }
);

StoryboardSchema.index({ projectId: 1, version: -1 });

export const StoryboardModel = mongoose.model<IStoryboard>('Storyboard', StoryboardSchema);

