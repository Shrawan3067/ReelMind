import { Request, Response, NextFunction } from 'express';
import { SemanticSearchService } from '../services/search/SemanticSearchService';
import { SearchHistoryModel } from '../models/SearchHistory';
import { NotFoundError } from '../utils/errors';

const searchService = new SemanticSearchService();

export async function semanticSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await searchService.executeHybridSearch(req.user!._id.toString(), req.body, true);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getSearchHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await SearchHistoryModel.find({ ownerId: req.user!._id })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        history: history.map(h => ({
          id: h._id.toString(),
          query: h.query,
          filters: h.filters,
          resultCount: h.resultCount,
          createdAt: h.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSearchHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleted = await SearchHistoryModel.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user!._id
    });
    if (!deleted) {
      throw new NotFoundError('Search history entry not found');
    }
    res.status(200).json({ success: true, message: 'Search history item deleted' });
  } catch (error) {
    next(error);
  }
}

