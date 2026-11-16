import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import * as mediaController from '../controllers/mediaController';
import { LocalUploadMediaAdapter } from '../adapters/media/LocalUploadMediaAdapter';
import { SUPPORTED_MIME_TYPES } from '../adapters/media/MediaSourceAdapter';
import { env } from '../config/env';
import { BadRequestError } from '../utils/errors';

const localAdapter = new LocalUploadMediaAdapter();

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const ownerId = req.user?._id?.toString() || 'anonymous';
    const dir = localAdapter.getUserUploadDirectory(ownerId);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE,
    files: 10
  },
  fileFilter: (_req, file, cb) => {
    if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
      cb(new BadRequestError(`Unsupported media MIME type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  }
});

const router = Router();
router.use(requireAuth);

router.get('/', mediaController.listMedia);
router.get('/quality-report', mediaController.getQualityReport);
router.get('/collections', mediaController.listCollections);
router.post('/collections', mediaController.createCollection);
router.post('/seed-demo', mediaController.seedDemoMedia);
router.post('/clear-demo', mediaController.clearDemoMedia);
router.post('/upload', upload.array('files', 10), mediaController.uploadMedia);

router.get('/:id', mediaController.getMediaById);
router.delete('/:id', mediaController.deleteMedia);
router.post('/:id/analyze', mediaController.analyzeMedia);
router.get('/:id/scenes', mediaController.getMediaScenes);
router.patch('/:id/favorite', mediaController.toggleFavorite);
router.patch('/:id/collections', mediaController.updateAssetCollections);
router.get('/:id/thumbnail', mediaController.serveThumbnail);
router.get('/:id/stream', mediaController.streamMedia);

export default router;

