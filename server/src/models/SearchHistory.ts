import mongoose, { Document, Schema } from 'mongoose';

export interface ISearchHistory extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  query: string;
  filters: Record<string, unknown>;
  resultCount: number;
  selectedMediaIds: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const SearchHistorySchema = new Schema<ISearchHistory>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    query: { type: String, required: true, trim: true },
    filters: { type: Schema.Types.Mixed, default: {} },
    resultCount: { type: Number, default: 0 },
    selectedMediaIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }]
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SearchHistorySchema.index({ ownerId: 1, createdAt: -1 });

export const SearchHistoryModel = mongoose.model<ISearchHistory>('SearchHistory', SearchHistorySchema);

