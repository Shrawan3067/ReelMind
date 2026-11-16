import { SourceType, MediaType } from '@reelmind/shared';

export interface DiscoveredMediaDescriptor {
  sourceType: SourceType;
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType: MediaType;
  storageReference: string;
  fileSize: number;
  isDemoData: boolean;
  metadata?: Record<string, unknown>;
}

export interface MediaSourceAdapter {
  readonly sourceType: SourceType;
  discoverMedia(ownerId: string): Promise<DiscoveredMediaDescriptor[]>;
  getConnectionStatus(): Promise<{
    connected: boolean;
    status: 'connected' | 'disconnected' | 'error';
    message: string;
  }>;
  validateStorageReference(storageReference: string): Promise<boolean>;
}

export const SUPPORTED_MEDIA_EXTENSIONS: Record<string, { mime: string; mediaType: MediaType }> = {
  '.mp4': { mime: 'video/mp4', mediaType: 'video' },
  '.mov': { mime: 'video/quicktime', mediaType: 'video' },
  '.mkv': { mime: 'video/x-matroska', mediaType: 'video' },
  '.avi': { mime: 'video/x-msvideo', mediaType: 'video' },
  '.webm': { mime: 'video/webm', mediaType: 'video' },
  '.jpg': { mime: 'image/jpeg', mediaType: 'image' },
  '.jpeg': { mime: 'image/jpeg', mediaType: 'image' },
  '.png': { mime: 'image/png', mediaType: 'image' },
  '.webp': { mime: 'image/webp', mediaType: 'image' },
  '.mp3': { mime: 'audio/mpeg', mediaType: 'audio' },
  '.wav': { mime: 'audio/wav', mediaType: 'audio' },
  '.m4a': { mime: 'audio/mp4', mediaType: 'audio' },
  '.aac': { mime: 'audio/aac', mediaType: 'audio' }
};

export const SUPPORTED_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/x-msvideo',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac'
]);

export function inferMediaTypeFromMime(mimeType: string): MediaType | null {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    return null;
  }
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  return null;
}

