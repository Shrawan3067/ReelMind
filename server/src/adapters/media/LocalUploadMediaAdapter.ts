import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../../config/env';
import {
  MediaSourceAdapter,
  DiscoveredMediaDescriptor,
  SUPPORTED_MEDIA_EXTENSIONS
} from './MediaSourceAdapter';

export class LocalUploadMediaAdapter implements MediaSourceAdapter {
  public readonly sourceType = 'local_upload' as const;
  private readonly baseDir: string;

  constructor(baseDir: string = env.UPLOAD_DIRECTORY) {
    this.baseDir = path.resolve(baseDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public getUserUploadDirectory(ownerId: string): string {
    const safeOwnerId = path.basename(ownerId);
    const dir = path.join(this.baseDir, safeOwnerId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public resolveSafePath(storageReference: string): string {
    const resolved = path.resolve(this.baseDir, storageReference);
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new Error('Unauthorized path traversal attempt detected');
    }
    return resolved;
  }

  public async computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', err => reject(err));
    });
  }

  public async discoverMedia(ownerId: string): Promise<DiscoveredMediaDescriptor[]> {
    const userDir = this.getUserUploadDirectory(ownerId);
    const entries = await fs.promises.readdir(userDir, { withFileTypes: true });
    const discovered: DiscoveredMediaDescriptor[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const spec = SUPPORTED_MEDIA_EXTENSIONS[ext];
      if (!spec) continue;

      const fullPath = path.join(userDir, entry.name);
      const stats = await fs.promises.stat(fullPath);

      discovered.push({
        sourceType: 'local_upload',
        filename: entry.name,
        originalFilename: entry.name,
        mimeType: spec.mime,
        mediaType: spec.mediaType,
        storageReference: path.join(path.basename(ownerId), entry.name),
        fileSize: stats.size,
        isDemoData: false
      });
    }

    return discovered;
  }

  public async getConnectionStatus() {
    const exists = fs.existsSync(this.baseDir);
    return {
      connected: exists,
      status: exists ? ('connected' as const) : ('error' as const),
      message: exists ? 'Local upload storage ready' : 'Upload directory unavailable'
    };
  }

  public async validateStorageReference(storageReference: string): Promise<boolean> {
    try {
      const resolved = this.resolveSafePath(storageReference);
      return fs.existsSync(resolved);
    } catch {
      return false;
    }
  }
}

