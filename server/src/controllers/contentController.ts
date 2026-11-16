import { Request, Response, NextFunction } from 'express';
import { ContentStudioService } from '../services/content/ContentStudioService';

const contentService = new ContentStudioService();

export async function generateTitle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await contentService.generateContent(req.user!._id.toString(), 'title', req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function generateCaption(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await contentService.generateContent(req.user!._id.toString(), 'caption', req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function generateDescription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await contentService.generateContent(req.user!._id.toString(), 'description', req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function generateHashtags(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await contentService.generateContent(req.user!._id.toString(), 'hashtags', req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function generatePack(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await contentService.generateContent(req.user!._id.toString(), 'full_pack', req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

