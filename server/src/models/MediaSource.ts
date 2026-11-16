import mongoose, { Document, Schema } from 'mongoose';

export interface IMediaSource extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  sourceType: 'ugreen_nas' | 'local_upload' | 'demo';
  provider: string;
  name: string;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'syncing';
  configuration: {
    host?: string;
    port?: number;
    useSsl?: boolean;
    encryptedApiKey?: string;
    encryptedCredentials?: string;
    nasMountPoint?: string;
    shareName?: string;
  };
  permissions: {
    readOnly: boolean;
    allowedDirectories: string[];
  };
  lastSyncedAt?: Date;
  syncErrors?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MediaSourceSchema = new Schema<IMediaSource>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceType: { type: String, enum: ['ugreen_nas', 'local_upload', 'demo'], required: true },
    provider: { type: String, required: true },
    name: { type: String, required: true },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'syncing'],
      default: 'disconnected',
      index: true
    },
    configuration: {
      host: { type: String },
      port: { type: Number, default: 80 },
      useSsl: { type: Boolean, default: false },
      encryptedApiKey: { type: String },
      encryptedCredentials: { type: String },
      nasMountPoint: { type: String },
      shareName: { type: String }
    },
    permissions: {
      readOnly: { type: Boolean, default: true },
      allowedDirectories: [{ type: String }]
    },
    lastSyncedAt: { type: Date },
    syncErrors: [{ type: String }]
  },
  { timestamps: true }
);

MediaSourceSchema.index({ ownerId: 1, sourceType: 1 });

export const MediaSourceModel = mongoose.model<IMediaSource>('MediaSource', MediaSourceSchema);

