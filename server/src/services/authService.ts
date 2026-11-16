import bcrypt from 'bcryptjs';
import { RegisterInput, LoginInput, UserPreferences } from '@reelmind/shared';
import { UserModel, IUser } from '../models/User';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError
} from '../utils/errors';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken
} from '../utils/token';
import { encryptSecret } from '../utils/crypto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUserDto {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin';
  preferences: UserPreferences;
  aiConfig: {
    provider: string;
    model?: string;
    embeddingModel?: string;
    baseUrl?: string;
    hasApiKey: boolean;
  };
  createdAt: Date;
}

export function toSafeUserDto(user: IUser): SafeUserDto {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    preferences: user.preferences,
    aiConfig: {
      provider: user.aiConfig?.provider ?? 'none',
      model: user.aiConfig?.model,
      embeddingModel: user.aiConfig?.embeddingModel,
      baseUrl: user.aiConfig?.baseUrl,
      hasApiKey: Boolean(user.aiConfig?.encryptedApiKey)
    },
    createdAt: user.createdAt
  };
}

export async function registerUser(
  input: RegisterInput,
  userAgent?: string
): Promise<{ user: SafeUserDto; tokens: AuthTokens }> {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = new UserModel({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash,
    role: 'user',
    preferences: {
      theme: 'dark',
      defaultAspectRatio: '16:9',
      aiProvider: 'none',
      autoProcessUploads: true
    },
    aiConfig: {
      provider: 'none'
    },
    refreshSessions: []
  });

  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  user.refreshSessions.push({
    tokenHash: hashRefreshToken(refreshToken),
    userAgent,
    createdAt: new Date(),
    expiresAt
  });

  await user.save();

  return {
    user: toSafeUserDto(user),
    tokens: { accessToken, refreshToken }
  };
}

export async function loginUser(
  input: LoginInput,
  userAgent?: string
): Promise<{ user: SafeUserDto; tokens: AuthTokens }> {
  const user = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Prune expired sessions and keep max 10 active sessions per user
  const now = new Date();
  user.refreshSessions = user.refreshSessions
    .filter(s => s.expiresAt > now)
    .slice(-9);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  user.refreshSessions.push({
    tokenHash: hashRefreshToken(refreshToken),
    userAgent,
    createdAt: now,
    expiresAt
  });

  await user.save();

  return {
    user: toSafeUserDto(user),
    tokens: { accessToken, refreshToken }
  };
}

export async function refreshAuthTokens(
  refreshToken: string,
  userAgent?: string
): Promise<{ user: SafeUserDto; tokens: AuthTokens }> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await UserModel.findById(payload.userId);
  if (!user) {
    throw new UnauthorizedError('Account not found');
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const sessionIdx = user.refreshSessions.findIndex(
    s => s.tokenHash === tokenHash && s.expiresAt > now
  );

  if (sessionIdx === -1) {
    // Potential token reuse or revoked session
    throw new UnauthorizedError('Refresh session expired or revoked');
  }

  // Rotate refresh token
  user.refreshSessions.splice(sessionIdx, 1);

  const newPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  };

  const newAccessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  user.refreshSessions.push({
    tokenHash: hashRefreshToken(newRefreshToken),
    userAgent,
    createdAt: now,
    expiresAt
  });

  await user.save();

  return {
    user: toSafeUserDto(user),
    tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken }
  };
}

export async function logoutUser(userId: string, refreshToken?: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) return;

  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    user.refreshSessions = user.refreshSessions.filter(s => s.tokenHash !== tokenHash);
  } else {
    user.refreshSessions = [];
  }

  await user.save();
}

export async function updateUserProfile(
  userId: string,
  updates: {
    name?: string;
    preferences?: Partial<UserPreferences>;
    aiConfig?: {
      provider?: 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'none';
      apiKey?: string;
      model?: string;
      embeddingModel?: string;
      baseUrl?: string;
    };
  }
): Promise<SafeUserDto> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (updates.name) {
    user.name = updates.name;
  }

  if (updates.preferences) {
    user.preferences = {
      ...user.preferences,
      ...updates.preferences
    };
  }

  if (updates.aiConfig) {
    if (updates.aiConfig.provider !== undefined) {
      user.aiConfig.provider = updates.aiConfig.provider;
    }
    if (updates.aiConfig.model !== undefined) {
      user.aiConfig.model = updates.aiConfig.model;
    }
    if (updates.aiConfig.embeddingModel !== undefined) {
      user.aiConfig.embeddingModel = updates.aiConfig.embeddingModel;
    }
    if (updates.aiConfig.baseUrl !== undefined) {
      user.aiConfig.baseUrl = updates.aiConfig.baseUrl;
    }
    if (updates.aiConfig.apiKey && updates.aiConfig.apiKey.trim().length > 0) {
      user.aiConfig.encryptedApiKey = encryptSecret(updates.aiConfig.apiKey.trim());
    }
  }

  await user.save();
  return toSafeUserDto(user);
}

export async function listUserSessions(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  const now = new Date();
  return user.refreshSessions
    .filter(s => s.expiresAt > now)
    .map((s, idx) => ({
      sessionId: (s as unknown as { _id?: { toString: () => string } })._id?.toString() || String(idx),
      userAgent: s.userAgent || 'Unknown client',
      createdAt: s.createdAt,
      expiresAt: s.expiresAt
    }));
}

export async function revokeUserSession(userId: string, sessionId: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  const initialLen = user.refreshSessions.length;
  user.refreshSessions = user.refreshSessions.filter(s => {
    const id = (s as unknown as { _id?: { toString: () => string } })._id?.toString();
    return id !== sessionId;
  });

  if (user.refreshSessions.length === initialLen) {
    throw new NotFoundError('Session not found');
  }
  await user.save();
}

