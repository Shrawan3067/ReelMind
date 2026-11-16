import mongoose, { Document, Schema } from 'mongoose';

export interface ICollection extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  color: string;
  mediaAssetIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CollectionSchema = new Schema<ICollection>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, maxlength: 300 },
    color: { type: String, default: '#3B82F6' },
    mediaAssetIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }]
  },
  { timestamps: true }
);

CollectionSchema.index({ ownerId: 1, name: 1 }, { unique: true });

export const CollectionModel = mongoose.model<ICollection>('Collection', CollectionSchema);

