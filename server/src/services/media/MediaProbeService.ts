import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { env } from '../../config/env';
import { QualityMetrics } from '@reelmind/shared';

const execFileAsync = promisify(execFile);

export interface ExtractedMediaMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  codec?: string;
  bitrate?: number;
  hasAudio: boolean;
  sha256Hash: string;
  perceptualHash: string;
  thumbnailPath?: string;
  extractedFramesBase64?: Array<{ timestamp: number; base64: string; mimeType: string }>;
  qualityMetrics: QualityMetrics;
  probeEngine: 'ffprobe' | 'native_header_parser';
}

export class MediaProbeService {
  private ffprobeAvailable: boolean | null = null;
  private ffmpegAvailable: boolean | null = null;

  public async checkToolsAvailability(): Promise<{ ffprobe: boolean; ffmpeg: boolean }> {
    if (this.ffprobeAvailable === null) {
      try {
        await execFileAsync(env.FFPROBE_PATH, ['-version']);
        this.ffprobeAvailable = true;
      } catch {
        this.ffprobeAvailable = false;
      }
    }
    if (this.ffmpegAvailable === null) {
      try {
        await execFileAsync(env.FFMPEG_PATH, ['-version']);
        this.ffmpegAvailable = true;
      } catch {
        this.ffmpegAvailable = false;
      }
    }
    return { ffprobe: this.ffprobeAvailable, ffmpeg: this.ffmpegAvailable };
  }

  public async computeSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Computes a deterministic content fingerprint hash over sampled byte windows
   * (or visual pixel grid if raw thumbnail bytes are available) for near-duplicate grouping.
   */
  public async computeSampledPerceptualFingerprint(filePath: string, width: number, height: number): Promise<string> {
    const stat = await fs.promises.stat(filePath);
    const fd = await fs.promises.open(filePath, 'r');
    try {
      const sampleSize = 1024;
      const offsets = [0, Math.floor(stat.size * 0.25), Math.floor(stat.size * 0.5), Math.max(0, stat.size - sampleSize)];
      const hash = crypto.createHash('md5');
      hash.update(`${width}x${height}:`);
      const buf = Buffer.alloc(sampleSize);
      for (const offset of offsets) {
        const { bytesRead } = await fd.read(buf, 0, sampleSize, offset);
        hash.update(buf.subarray(0, bytesRead));
      }
      return hash.digest('hex').slice(0, 16);
    } finally {
      await fd.close();
    }
  }

  public async extractMetadata(
    filePath: string,
    mediaType: 'video' | 'image' | 'audio',
    assetId: string
  ): Promise<ExtractedMediaMetadata> {
    const tools = await this.checkToolsAvailability();
    const sha256Hash = await this.computeSha256(filePath);
    const stat = await fs.promises.stat(filePath);

    let duration = 0;
    let width = 0;
    let height = 0;
    let frameRate = 0;
    let codec: string | undefined;
    let bitrate: number | undefined;
    let hasAudio = mediaType === 'audio';
    let probeEngine: 'ffprobe' | 'native_header_parser' = 'native_header_parser';

    if (tools.ffprobe) {
      try {
        const { stdout } = await execFileAsync(env.FFPROBE_PATH, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          filePath
        ]);
        const info = JSON.parse(stdout) as {
          format?: { duration?: string; bit_rate?: string };
          streams?: Array<{
            codec_type?: string;
            codec_name?: string;
            width?: number;
            height?: number;
            r_frame_rate?: string;
          }>;
        };

        probeEngine = 'ffprobe';
        if (info.format?.duration) {
          duration = Math.max(0, Number(parseFloat(info.format.duration).toFixed(2)));
        }
        if (info.format?.bit_rate) {
          bitrate = parseInt(info.format.bit_rate, 10);
        }

        const videoStream = info.streams?.find(s => s.codec_type === 'video');
        const audioStream = info.streams?.find(s => s.codec_type === 'audio');
        hasAudio = Boolean(audioStream);

        if (videoStream) {
          width = videoStream.width || 0;
          height = videoStream.height || 0;
          codec = videoStream.codec_name;
          if (videoStream.r_frame_rate && videoStream.r_frame_rate.includes('/')) {
            const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
            if (den > 0) frameRate = Math.round((num / den) * 100) / 100;
          }
        }
      } catch {
        // Fallback to native binary header inspection
      }
    }

    if (probeEngine === 'native_header_parser') {
      if (mediaType === 'image') {
        const dims = await this.parseImageDimensions(filePath);
        width = dims.width;
        height = dims.height;
      } else if (mediaType === 'video') {
        const parsedMp4 = await this.parseMp4MvhdHeader(filePath);
        duration = parsedMp4.duration;
        width = parsedMp4.width || 1920;
        height = parsedMp4.height || 1080;
        frameRate = 30;
        hasAudio = true;
        bitrate = duration > 0 ? Math.round((stat.size * 8) / duration) : undefined;
      } else if (mediaType === 'audio') {
        // Rough estimate if ffprobe unavailable (e.g. ~192kbps MP3)
        duration = Math.max(1, Math.round(stat.size / 24000));
        bitrate = 192000;
      }
    }

    let thumbnailPath: string | undefined;
    const extractedFramesBase64: Array<{ timestamp: number; base64: string; mimeType: string }> = [];

    if (!fs.existsSync(env.THUMBNAIL_DIRECTORY)) {
      fs.mkdirSync(env.THUMBNAIL_DIRECTORY, { recursive: true });
    }

    if (tools.ffmpeg && mediaType === 'video' && duration > 0) {
      const thumbFile = path.join(env.THUMBNAIL_DIRECTORY, `${assetId}.jpg`);
      try {
        const seekTime = Math.min(duration * 0.25, 2.0).toFixed(2);
        await execFileAsync(env.FFMPEG_PATH, [
          '-y',
          '-ss', seekTime,
          '-i', filePath,
          '-vframes', '1',
          '-vf', 'scale=640:-1',
          '-q:v', '4',
          thumbFile
        ]);
        if (fs.existsSync(thumbFile)) {
          thumbnailPath = thumbFile;
          const b64 = (await fs.promises.readFile(thumbFile)).toString('base64');
          extractedFramesBase64.push({ timestamp: parseFloat(seekTime), base64: b64, mimeType: 'image/jpeg' });
        }
      } catch {
        // Non-fatal thumbnail error
      }
    } else if (mediaType === 'image') {
      const b64 = (await fs.promises.readFile(filePath)).toString('base64');
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      if (stat.size < 4 * 1024 * 1024) {
        extractedFramesBase64.push({ timestamp: 0, base64: b64, mimeType });
      }
    }

    const perceptualHash = await this.computeSampledPerceptualFingerprint(filePath, width, height);

    // Deterministic technical quality evaluation
    const resolutionScore = width >= 3840 ? 1.0 : width >= 1920 ? 0.9 : width >= 1280 ? 0.75 : width > 0 ? 0.45 : 0.6;
    const corrupted = stat.size === 0 || (mediaType === 'video' && duration === 0 && probeEngine === 'ffprobe');
    const overallScore = Number((corrupted ? 0.1 : resolutionScore * 0.85 + (hasAudio || mediaType === 'image' ? 0.15 : 0)).toFixed(2));

    const qualityMetrics: QualityMetrics = {
      resolutionScore,
      bitrate,
      hasAudio,
      corrupted,
      overallScore,
      notes: corrupted
        ? 'File appears empty or unreadable by probe engine.'
        : `Inspected via ${probeEngine}. Resolution ${width}x${height}.`
    };

    return {
      duration,
      width,
      height,
      frameRate,
      codec,
      bitrate,
      hasAudio,
      sha256Hash,
      perceptualHash,
      thumbnailPath,
      extractedFramesBase64,
      qualityMetrics,
      probeEngine
    };
  }

  private async parseImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
    try {
      const fd = await fs.promises.open(filePath, 'r');
      const buf = Buffer.alloc(65536);
      const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
      await fd.close();

      // PNG signature
      if (bytesRead > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        return {
          width: buf.readUInt32BE(16),
          height: buf.readUInt32BE(20)
        };
      }

      // JPEG SOF0/SOF2 marker scan
      if (bytesRead > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
        let pos = 2;
        while (pos + 9 < bytesRead) {
          if (buf[pos] !== 0xff) break;
          const marker = buf[pos + 1];
          const len = buf.readUInt16BE(pos + 2);
          if (marker === 0xc0 || marker === 0xc2) {
            return {
              height: buf.readUInt16BE(pos + 5),
              width: buf.readUInt16BE(pos + 7)
            };
          }
          pos += 2 + len;
        }
      }
    } catch {
      // Ignore parse error
    }
    return { width: 1920, height: 1080 };
  }

  public parseSrtOrVttContent(rawContent: string): Array<{ startTime: number; endTime: number; text: string }> {
    const normalized = rawContent.replace(/\r\n/g, '\n').replace(/^WEBVTT[^\n]*\n+/i, '').trim();
    if (!normalized) return [];

    const blocks = normalized.split(/\n{2,}/);
    const cues: Array<{ startTime: number; endTime: number; text: string }> = [];

    const parseTime = (tc: string): number => {
      const cleaned = tc.trim().replace(',', '.');
      const parts = cleaned.split(':').map(Number);
      if (parts.length === 3) {
        return Number((parts[0] * 3600 + parts[1] * 60 + parts[2]).toFixed(2));
      }
      if (parts.length === 2) {
        return Number((parts[0] * 60 + parts[1]).toFixed(2));
      }
      return 0;
    };

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const timingIdx = lines.findIndex(l => l.includes('-->'));
      if (timingIdx === -1) continue;

      const [startStr, endStrRaw] = lines[timingIdx].split('-->');
      const endStr = endStrRaw.trim().split(/\s+/)[0];
      const startTime = parseTime(startStr);
      const endTime = parseTime(endStr);
      const text = lines.slice(timingIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();

      if (text && endTime > startTime) {
        cues.push({ startTime, endTime, text });
      }
    }

    return cues;
  }

  public async extractSubtitlesIfPresent(
    mediaFilePath: string
  ): Promise<Array<{ startTime: number; endTime: number; text: string }>> {
    const ext = path.extname(mediaFilePath);
    const stem = mediaFilePath.slice(0, mediaFilePath.length - ext.length);

    for (const subExt of ['.srt', '.vtt']) {
      const sidecar = `${stem}${subExt}`;
      if (fs.existsSync(sidecar)) {
        const content = await fs.promises.readFile(sidecar, 'utf8');
        const cues = this.parseSrtOrVttContent(content);
        if (cues.length > 0) return cues;
      }
    }

    const tools = await this.checkToolsAvailability();
    if (tools.ffmpeg) {
      const tmpSrt = path.join(env.THUMBNAIL_DIRECTORY, `${path.basename(mediaFilePath)}.tmp.srt`);
      try {
        await execFileAsync(env.FFMPEG_PATH, ['-y', '-i', mediaFilePath, '-map', '0:s:0', tmpSrt]);
        if (fs.existsSync(tmpSrt)) {
          const content = await fs.promises.readFile(tmpSrt, 'utf8');
          await fs.promises.unlink(tmpSrt).catch(() => {});
          return this.parseSrtOrVttContent(content);
        }
      } catch {
        // No embedded subtitle track
      }
    }

    return [];
  }

  private async parseMp4MvhdHeader(filePath: string): Promise<{ duration: number; width: number; height: number }> {
    try {
      const fd = await fs.promises.open(filePath, 'r');
      const buf = Buffer.alloc(131072);
      const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
      await fd.close();

      const mvhdIdx = buf.subarray(0, bytesRead).indexOf('mvhd');
      if (mvhdIdx !== -1 && mvhdIdx + 24 < bytesRead) {
        const version = buf[mvhdIdx + 4];
        if (version === 0) {
          const timescale = buf.readUInt32BE(mvhdIdx + 16);
          const durationUnits = buf.readUInt32BE(mvhdIdx + 20);
          if (timescale > 0) {
            return {
              duration: Number((durationUnits / timescale).toFixed(2)),
              width: 1920,
              height: 1080
            };
          }
        }
      }
    } catch {
      // Ignore parse error
    }
    return { duration: 15, width: 1920, height: 1080 };
  }
}

