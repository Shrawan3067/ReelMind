import mongoose, { Document, Schema } from 'mongoose';
import { UserPreferences } from '@reelmind/shared';

export interface IRefreshSession {
  tokenHash: string;
  userAgent?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IUserAiConfig {
  provider: 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'none';
  encryptedApiKey?: string;
  model?: string;
  embeddingModel?: string;
  baseUrl?: string;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  avatar?: string;
  role: 'user' | 'admin';
  preferences: UserPreferences;
  aiConfig: IUserAiConfig;
  refreshSessions: IRefreshSession[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    avatar: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    preferences: {
      theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
      defaultAspectRatio: { type: String, enum: ['16:9', '9:16', '1:1', '4:5'], default: '16:9' },
      aiProvider: { type: String, default: 'none' },
      autoProcessUploads: { type: Boolean, default: true }
    },
    aiConfig: {
      provider: { type: String, enum: ['openai', 'gemini', 'anthropic', 'ollama', 'none'], default: 'none' },
      encryptedApiKey: { type: String },
      model: { type: String },
      embeddingModel: { type: String },
      baseUrl: { type: String }
    },
    refreshSessions: [
      {
        tokenHash: { type: String, required: true },
        userAgent: { type: String },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true }
      }
    ]
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);

