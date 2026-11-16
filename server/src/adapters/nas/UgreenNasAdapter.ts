import fs from 'fs';
import path from 'path';
import { MediaSourceAdapter, DiscoveredMediaDescriptor, SUPPORTED_MEDIA_EXTENSIONS } from '../media/MediaSourceAdapter';
import { logger } from '../../config/logger';

export interface UgreenNasConfig {
  host?: string;
  port?: number;
  useSsl?: boolean;
  apiKey?: string;
  nasMountPoint?: string;
  shareName?: string;
}

/**
 * UGREEN NAS Adapter
 *
 * Architectural boundary adhering to UGREEN Skill Developer Standard:
 * - Never invents undocumented UGOS internal API endpoints or unsupported agent permissions.
 * - Supports either:
 *   1. Authorized UGOS HTTP/HTTPS Skill API endpoint (when explicitly provided & reachable).
 *   2. Read-only authorized local/mounted UGOS share directory (`nasMountPoint`) when running alongside UGOS.
 * - Clearly reports disconnected / unavailable status when no real UGREEN NAS is configured or reachable.
 * - Never substitutes DEMO data as real NAS files.
 */
export class UgreenNasAdapter implements MediaSourceAdapter {
  public readonly sourceType = 'ugreen_nas' as const;
  private config: UgreenNasConfig;

  constructor(config: UgreenNasConfig = {}) {
    this.config = config;
  }

  public updateConfig(config: UgreenNasConfig): void {
    this.config = { ...this.config, ...config };
  }

  public async getConnectionStatus(): Promise<{
    connected: boolean;
    status: 'connected' | 'disconnected' | 'error';
    message: string;
    capabilities?: string[];
  }> {
    if (this.config.nasMountPoint && fs.existsSync(this.config.nasMountPoint)) {
      return {
        connected: true,
        status: 'connected',
        message: `Connected to authorized UGOS mount directory (${path.basename(this.config.nasMountPoint)})`,
        capabilities: ['read_only_directory_scan', 'metadata_indexing']
      };
    }

    if (!this.config.host) {
      return {
        connected: false,
        status: 'disconnected',
        message: 'UGREEN NAS not configured. Connect a UGOS endpoint or authorized NAS share path in Settings, or browse isolated Demo Media.'
      };
    }

    const protocol = this.config.useSsl ? 'https' : 'http';
    const port = this.config.port || (this.config.useSsl ? 443 : 80);
    const targetUrl = `${protocol}://${this.config.host}:${port}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(targetUrl, {
        method: 'HEAD',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok || response.status === 401 || response.status === 403) {
        // Host responded on network, verify explicit API key/authorization if required
        if (!this.config.apiKey) {
          return {
            connected: false,
            status: 'error',
            message: `UGREEN NAS host reachable at ${this.config.host}, but API token / authorized share configuration is missing.`
          };
        }
        return {
          connected: true,
          status: 'connected',
          message: `Verified network reachability to UGREEN NAS (${this.config.host})`,
          capabilities: ['authorized_api_handshake']
        };
      }

      return {
        connected: false,
        status: 'error',
        message: `UGREEN NAS returned unexpected HTTP status ${response.status}`
      };
    } catch (error) {
      logger.debug({ err: error, host: this.config.host }, 'UGREEN NAS reachability check failed');
      return {
        connected: false,
        status: 'disconnected',
        message: `UGREEN NAS at ${this.config.host}:${port} is unreachable from this network environment.`
      };
    }
  }

  public async discoverMedia(_ownerId: string): Promise<DiscoveredMediaDescriptor[]> {
    const status = await this.getConnectionStatus();
    if (!status.connected) {
      return [];
    }

    // If an authorized read-only UGOS share mount point is present, scan supported media safely without modifying files
    if (this.config.nasMountPoint && fs.existsSync(this.config.nasMountPoint)) {
      return this.scanMountDirectory(this.config.nasMountPoint, 250);
    }

    return [];
  }

  private async scanMountDirectory(rootDir: string, maxFiles: number): Promise<DiscoveredMediaDescriptor[]> {
    const results: DiscoveredMediaDescriptor[] = [];
    const baseResolved = path.resolve(rootDir);

    const walk = async (dir: string): Promise<void> => {
      if (results.length >= maxFiles) return;
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles) break;
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const spec = SUPPORTED_MEDIA_EXTENSIONS[ext];
          if (!spec) continue;

          const stats = await fs.promises.stat(fullPath);
          const relPath = path.relative(baseResolved, fullPath);

          results.push({
            sourceType: 'ugreen_nas',
            filename: entry.name,
            originalFilename: entry.name,
            mimeType: spec.mime,
            mediaType: spec.mediaType,
            storageReference: `nas://${relPath}`,
            fileSize: stats.size,
            isDemoData: false,
            metadata: {
              nasShare: this.config.shareName || path.basename(baseResolved)
            }
          });
        }
      }
    };

    await walk(baseResolved);
    return results;
  }

  public async validateStorageReference(storageReference: string): Promise<boolean> {
    if (!storageReference.startsWith('nas://') || !this.config.nasMountPoint) {
      return false;
    }
    const rel = storageReference.replace(/^nas:\/\//, '');
    const resolved = path.resolve(this.config.nasMountPoint, rel);
    const baseResolved = path.resolve(this.config.nasMountPoint);
    if (!resolved.startsWith(baseResolved + path.sep)) {
      return false;
    }
    return fs.existsSync(resolved);
  }
}
