import { Request, Response, NextFunction } from 'express';
import { StoryboardService } from '../services/storyboard/StoryboardService';
import { StoryboardModel } from '../models/Storyboard';

const storyboardService = new StoryboardService();

export async function listStoryboards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const storyboards = await StoryboardModel.find({ ownerId: req.user!._id })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        storyboards: storyboards.map(s => ({ ...s, id: s._id.toString() }))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function generateStoryboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await storyboardService.generateStoryboard(req.user!._id.toString(), req.body);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getStoryboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const storyboard = await storyboardService.getStoryboardById(String(req.params.id), req.user!._id.toString());
    res.status(200).json({
      success: true,
      data: { storyboard }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStoryboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const storyboard = await storyboardService.updateStoryboard(
      String(req.params.id),
      req.user!._id.toString(),
      req.body
    );
    res.status(200).json({
      success: true,
      data: { storyboard }
    });
  } catch (error) {
    next(error);
  }
}

export async function regenerateScene(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sceneId, instruction } = req.body as { sceneId: string; instruction?: string };
    const storyboard = await storyboardService.regenerateScene(
      String(req.params.id),
      req.user!._id.toString(),
      sceneId,
      instruction
    );
    res.status(200).json({
      success: true,
      data: { storyboard }
    });
  } catch (error) {
    next(error);
  }
}

export async function exportStoryboardPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sb = await storyboardService.getStoryboardById(String(req.params.id), req.user!._id.toString());

    const format = String(req.body?.format || 'json').toLowerCase();

    if (format === 'edl') {
      // Standard CMX 3600 style Edit Decision List text representation
      const lines = [`TITLE: ${sb.title.toUpperCase()}`, `FCM: NON-DROP FRAME`, ''];
      sb.scenes.forEach((scene, i) => {
        const idxStr = String(i + 1).padStart(3, '0');
        lines.push(
          `${idxStr}  AX       V     C        ${formatTimecode(scene.sourceStartTime)} ${formatTimecode(scene.sourceEndTime)} ${formatTimecode(scene.timelineStartTime)} ${formatTimecode(scene.timelineEndTime)}`
        );
        lines.push(`* FROM CLIP NAME: ${scene.sourceFilename}`);
        if (scene.caption) {
          lines.push(`* COMMENT: CAPTION="${scene.caption}" TRANSITION=${scene.transition}`);
        }
      });

      res.status(200).json({
        success: true,
        data: {
          format: 'edl',
          filename: `${sb.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.edl`,
          note: 'Editing-ready EDL production plan generated. Video rendering is performed externally by an NLE or dedicated render worker.',
          content: lines.join('\n')
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        format: 'json',
        filename: `${sb.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_production_plan.json`,
        note: 'Editing-ready JSON production plan generated (non-destructive instruction manifest).',
        plan: {
          title: sb.title,
          creativeConcept: sb.creativeConcept,
          aspectRatio: sb.aspectRatio,
          targetDuration: sb.targetDuration,
          actualDuration: sb.actualDuration,
          mood: sb.mood,
          musicSuggestions: sb.musicSuggestions,
          editingNotes: sb.editingNotes,
          cuts: sb.scenes.map(s => ({
            order: s.order + 1,
            sourceFilename: s.sourceFilename,
            sourceType: s.sourceType,
            isDemoData: s.isDemoData,
            sourceIn: s.sourceStartTime,
            sourceOut: s.sourceEndTime,
            timelineIn: s.timelineStartTime,
            timelineOut: s.timelineEndTime,
            transition: s.transition,
            caption: s.caption,
            description: s.description
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

function formatTimecode(sec: number): string {
  const totalFrames = Math.round(sec * 30);
  const frames = totalFrames % 30;
  const totalSecs = Math.floor(totalFrames / 30);
  const s = totalSecs % 60;
  const m = Math.floor(totalSecs / 60) % 60;
  const h = Math.floor(totalSecs / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}
