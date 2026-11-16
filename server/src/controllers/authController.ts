import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  refreshAuthTokens,
  logoutUser,
  updateUserProfile,
  listUserSessions,
  revokeUserSession,
  toSafeUserDto
} from '../services/authService';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000
};

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 1000
};

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await registerUser(req.body, req.headers['user-agent']);
    res.cookie('reelmind_access_token', result.tokens.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('reelmind_refresh_token', result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await loginUser(req.body, req.headers['user-agent']);
    res.cookie('reelmind_access_token', result.tokens.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('reelmind_refresh_token', result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.cookies?.reelmind_refresh_token || req.body?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token missing');
    }
    const result = await refreshAuthTokens(refreshToken, req.headers['user-agent']);
    res.cookie('reelmind_access_token', result.tokens.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('reelmind_refresh_token', result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.cookies?.reelmind_refresh_token || req.body?.refreshToken;
    if (req.user) {
      await logoutUser(req.user._id.toString(), refreshToken);
    }
    res.clearCookie('reelmind_access_token');
    res.clearCookie('reelmind_refresh_token');
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    res.status(200).json({
      success: true,
      data: {
        user: toSafeUserDto(req.user)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const updatedUser = await updateUserProfile(req.user._id.toString(), req.body);
    res.status(200).json({
      success: true,
      data: { user: updatedUser }
    });
  } catch (error) {
    next(error);
  }
}

export async function getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessions = await listUserSessions(req.user!._id.toString());
    res.status(200).json({ success: true, data: { sessions } });
  } catch (error) {
    next(error);
  }
}

export async function deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await revokeUserSession(req.user!._id.toString(), String(req.params.sessionId));
    res.status(200).json({ success: true, message: 'Session revoked' });
  } catch (error) {
    next(error);
  }
}
