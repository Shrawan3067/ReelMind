import { Request, Response, NextFunction } from 'express';
import { ProjectModel } from '../models/Project';
import { StoryboardModel } from '../models/Storyboard';
import { NotFoundError, BadRequestError } from '../utils/errors';

export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));

    const [projects, total] = await Promise.all([
      ProjectModel.find({ ownerId: req.user!._id })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('activeStoryboardId', 'title actualDuration aspectRatio mood version')
        .lean(),
      ProjectModel.countDocuments({ ownerId: req.user!._id })
    ]);

    res.status(200).json({
      success: true,
      data: {
        projects: projects.map(p => ({ ...p, id: p._id.toString() })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, description, prompt, targetDuration, aspectRatio } = req.body as {
      title: string;
      description?: string;
      prompt: string;
      targetDuration?: number;
      aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
    };

    if (!title || !prompt) {
      throw new BadRequestError('Title and prompt are required');
    }

    const project = await ProjectModel.create({
      ownerId: req.user!._id,
      title,
      description: description || '',
      prompt,
      targetDuration: targetDuration || 30,
      aspectRatio: aspectRatio || '16:9',
      status: 'draft'
    });

    res.status(201).json({
      success: true,
      data: { project: { ...project.toObject(), id: project._id.toString() } }
    });
  } catch (error) {
    next(error);
  }
}

export async function getProjectById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await ProjectModel.findOne({
      _id: req.params.id,
      ownerId: req.user!._id
    }).lean();

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const storyboard = project.activeStoryboardId
      ? await StoryboardModel.findOne({ _id: project.activeStoryboardId, ownerId: req.user!._id }).lean()
      : null;

    res.status(200).json({
      success: true,
      data: {
        project: { ...project, id: project._id.toString() },
        storyboard: storyboard ? { ...storyboard, id: storyboard._id.toString() } : null
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const allowedUpdates: Record<string, unknown> = {};
    const fields = ['title', 'description', 'status', 'targetDuration', 'aspectRatio'];
    for (const f of fields) {
      if (req.body[f] !== undefined) allowedUpdates[f] = req.body[f];
    }

    const project = await ProjectModel.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user!._id },
      { $set: allowedUpdates },
      { new: true }
    ).lean();

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    res.status(200).json({
      success: true,
      data: { project: { ...project, id: project._id.toString() } }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await ProjectModel.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user!._id
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    await StoryboardModel.deleteMany({ projectId: project._id, ownerId: req.user!._id });
    res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
}

