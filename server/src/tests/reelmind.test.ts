import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { ClipRankingAgent } from '../services/ai/ClipRankingAgent';
import { IntentUnderstandingAgent } from '../services/ai/IntentUnderstandingAgent';
import { MediaProbeService } from '../services/media/MediaProbeService';
import { AIProviderAdapter } from '../adapters/ai/AIProviderAdapter';
import { z } from 'zod';

let mongoServer: MongoMemoryServer;
const app = createApp();

let userAToken = '';
let userARefresh = '';
let userBToken = '';
let generatedStoryboardId = '';
let firstSceneId = '';
let dogMediaId = '';
let testUserId = '';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const systemMongod = '/usr/local/bin/mongod';
  mongoServer = await MongoMemoryServer.create(
    fs.existsSync(systemMongod) ? { binary: { systemBinary: systemMongod } } : undefined
  );
  await mongoose.connect(mongoServer.getUri());
}, 60000);

afterAll(async () => {
  await new Promise(r => setTimeout(r, 300));
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  if (testUserId) {
    const uploadDir = path.resolve(process.cwd(), 'uploads', testUserId);
    if (fs.existsSync(uploadDir)) {
      await fs.promises.rm(uploadDir, { recursive: true, force: true });
    }
  }
});

describe('ReelMind End-to-End Backend & AI Pipeline Tests', () => {
  describe('1. Authentication & Session Security', () => {
    it('registers User A and returns tokens without leaking passwordHash', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Alice Creator',
        email: 'alice@reelmind.test',
        password: 'SecurePassword123!'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alice@reelmind.test');
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
      userAToken = res.body.data.accessToken;
      userARefresh = res.body.data.refreshToken;
      testUserId = res.body.data.user.id;
    });

    it('rejects duplicate email registration', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Alice Clone',
        email: 'alice@reelmind.test',
        password: 'SecurePassword123!'
      });
      expect(res.status).toBe(409);
    });

    it('rejects invalid login credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'alice@reelmind.test',
        password: 'WrongPassword!'
      });
      expect(res.status).toBe(401);
    });

    it('blocks protected routes without token', async () => {
      const res = await request(app).get('/api/v1/media');
      expect(res.status).toBe(401);
    });

    it('rotates refresh token cleanly', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: userARefresh });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(userARefresh);
      userAToken = res.body.data.accessToken;
      userARefresh = res.body.data.refreshToken;
    });

    it('registers User B for cross-user authorization isolation checks', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Bob User',
        email: 'bob@reelmind.test',
        password: 'SecurePassword123!'
      });
      expect(res.status).toBe(201);
      userBToken = res.body.data.accessToken;
    });
  });

  describe('2. Media Library, Demo Data Isolation & Upload Validation', () => {
    it('seeds isolated 150-asset demo library (100 videos + 50 images) labeled as DEMO DATA', async () => {
      const res = await request(app)
        .post('/api/v1/media/seed-demo')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.assetsCreated).toBe(150);
      expect(res.body.data.scenesCreated).toBeGreaterThan(150);
    });

    it('supports paginated media browsing and filtering', async () => {
      const res = await request(app)
        .get('/api/v1/media?page=1&limit=20&mediaType=video')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(20);
      expect(res.body.data.pagination.total).toBe(100);
      expect(res.body.data.items[0].isDemoData).toBe(true);
    });

    it('rejects unsupported file formats on upload', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('files', Buffer.from('not-an-exe'), {
          filename: 'malware.exe',
          contentType: 'application/x-msdownload'
        });

      expect(res.status).toBe(400);
    });

    it('accepts valid image upload and assigns async job cleanly', async () => {
      // Minimal valid 1x1 PNG bytes
      const pngBytes = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
        'hex'
      );
      const res = await request(app)
        .post('/api/v1/media/upload')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('files', pngBytes, {
          filename: 'studio_test_frame.png',
          contentType: 'image/png'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.assets.length).toBe(1);
      expect(res.body.data.assets[0].isDemoData).toBe(false);
      expect(res.body.data.jobs.length).toBe(1);
    });

    it('generates duplicate and low-quality audit report without auto-deleting files', async () => {
      const res = await request(app)
        .get('/api/v1/media/quality-report')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalScanned).toBeGreaterThanOrEqual(150);
      expect(res.body.data.exactDuplicateGroups.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.lowQualityClips.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.potentialStorageSavingsBytes).toBeGreaterThan(0);
    });
  });

  describe('3. Semantic Video Search & Clip Ranking Intelligence', () => {
    it('finds dog swimming pool clips with real source files and verified timestamps', async () => {
      const res = await request(app)
        .post('/api/v1/search/semantic')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          query: 'Find every clip where a dog jumps into a swimming pool',
          mediaTypes: ['video'],
          limit: 10
        });

      expect(res.status).toBe(200);
      const results = res.body.data.results;
      expect(results.length).toBeGreaterThan(0);
      const filenames = results.map((r: { filename: string }) => r.filename);
      expect(filenames.some((f: string) => f.includes('dog_pool'))).toBe(true);
      expect(results[0].startTime).toBeGreaterThanOrEqual(0);
      expect(results[0].endTime).toBeLessThanOrEqual(results[0].duration);
      expect(results[0].explanation).toBeTruthy();
      dogMediaId = results[0].mediaAssetId;
    });

    it('renormalizes ClipRankingAgent weights accurately when dimensions are missing', () => {
      const agent = new ClipRankingAgent();
      const partial = agent.scoreCandidate({
        semanticRelevance: 0.9,
        evidenceSource: 'metadata'
      });
      const weightSum = Object.values(partial.weightsUsed).reduce((a, b) => a + b, 0);
      expect(weightSum).toBeCloseTo(1.0, 2);
      expect(partial.weightsUsed.visualQuality).toBeUndefined();
      expect(partial.finalScore).toBeCloseTo(0.9, 2);
    });

    it('handles external AI provider failure gracefully without crashing', async () => {
      const badAdapter = new AIProviderAdapter({
        provider: 'openai',
        apiKey: 'sk-invalid-test-key',
        baseUrl: 'http://127.0.0.1:59999' // unreachable port
      });
      const result = await badAdapter.generateStructuredJson(
        'system',
        'user',
        z.object({ test: z.string() })
      );
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('4. Signature Storyboard Generation, Validation & Regeneration', () => {
    it('generates a validated 30-second storyboard for dog swimming pool prompt', async () => {
      const res = await request(app)
        .post('/api/v1/storyboards/generate')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          prompt: 'Create a 30-second cinematic video of a dog enjoying a swimming pool.',
          targetDuration: 30,
          aspectRatio: '16:9'
        });

      expect(res.status).toBe(201);
      const sb = res.body.data.storyboard;
      expect(sb.title).toBeTruthy();
      expect(sb.scenes.length).toBeGreaterThanOrEqual(3);
      expect(sb.actualDuration).toBeGreaterThan(15);
      expect(sb.actualDuration).toBeLessThanOrEqual(31);

      // Verify strict timestamp boundary invariants
      for (let i = 0; i < sb.scenes.length; i++) {
        const s = sb.scenes[i];
        expect(s.sourceEndTime).toBeGreaterThan(s.sourceStartTime);
        expect(s.sourceEndTime).toBeLessThanOrEqual(s.sourceDuration + 0.05);
        expect(s.timelineEndTime).toBeGreaterThan(s.timelineStartTime);
        if (i > 0) {
          expect(s.timelineStartTime).toBeCloseTo(sb.scenes[i - 1].timelineEndTime, 1);
        }
      }

      generatedStoryboardId = sb.id;
      firstSceneId = sb.scenes[0].id;
    });

    it('allows single-scene regeneration without regenerating entire storyboard', async () => {
      const res = await request(app)
        .post(`/api/v1/storyboards/${generatedStoryboardId}/regenerate-scene`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          sceneId: firstSceneId,
          instruction: 'dog splashing in swimming pool'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.storyboard.version).toBe(2);
      expect(res.body.data.storyboard.scenes.length).toBeGreaterThanOrEqual(3);
    });

    it('prevents cross-user access to private media and storyboards (User B -> User A)', async () => {
      const mediaRes = await request(app)
        .get(`/api/v1/media/${dogMediaId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(mediaRes.status).toBe(404);

      const sbRes = await request(app)
        .get(`/api/v1/storyboards/${generatedStoryboardId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(sbRes.status).toBe(404);
    });

    it('exports editing-ready JSON and EDL production plans cleanly', async () => {
      const edlRes = await request(app)
        .post(`/api/v1/storyboards/${generatedStoryboardId}/export-plan`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ format: 'edl' });

      expect(edlRes.status).toBe(200);
      expect(edlRes.body.data.content).toContain('TITLE:');
      expect(edlRes.body.data.content).toContain('FROM CLIP NAME:');
    });
  });

  describe('5. AI Content Studio & NAS Status Integrity', () => {
    it('generates grounded social pack from storyboard', async () => {
      const res = await request(app)
        .post('/api/v1/content/generate-pack')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          platform: 'youtube',
          tone: 'cinematic',
          audience: 'dog lovers',
          language: 'English',
          storyboardId: generatedStoryboardId,
          topicOrSummary: 'Golden retriever summer swimming pool highlights'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.groundedInStoryboard).toBe(true);
      expect(res.body.data.titles.length).toBeGreaterThan(0);
      expect(res.body.data.narrationScript.length).toBeGreaterThan(0);
    });

    it('reports NAS disconnected honestly when unconfigured without faking NAS files', async () => {
      const res = await request(app)
        .get('/api/v1/nas/status')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.connected).toBe(false);
      expect(res.body.data.status).toBe('disconnected');
    });
  });

  describe('6. Sessions, Filtering, Collections & Core Unit Services', () => {
    it('lists and revokes active user sessions cleanly', async () => {
      const listRes = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.sessions.length).toBeGreaterThanOrEqual(1);
      const sessionId = listRes.body.data.sessions[0].sessionId;

      const delRes = await request(app)
        .delete(`/api/v1/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(delRes.status).toBe(200);
    });

    it('filters media by duration range and assigns collections', async () => {
      const durRes = await request(app)
        .get('/api/v1/media?mediaType=video&minDuration=20&maxDuration=40')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(durRes.status).toBe(200);
      expect(durRes.body.data.items.length).toBeGreaterThan(0);
      for (const item of durRes.body.data.items) {
        expect(item.duration).toBeGreaterThanOrEqual(20);
        expect(item.duration).toBeLessThanOrEqual(40);
      }

      const colRes = await request(app)
        .patch(`/api/v1/media/${dogMediaId}/collections`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ collections: ['Dog Pool Clips', 'Best 2026'] });

      expect(colRes.status).toBe(200);
      expect(colRes.body.data.collections).toContain('Best 2026');
    });

    it('parses creative intent deterministically (duration, aspect ratio, mood)', () => {
      const agent = new IntentUnderstandingAgent();
      const parsed = agent.deterministicParse(
        'Create an energetic 45-second vertical Shorts video about mountain hiking'
      );
      expect(parsed.targetDurationSeconds).toBe(45);
      expect(parsed.suggestedAspectRatio).toBe('9:16');
      expect(parsed.mood).toContain('Energetic');
      expect(parsed.visualKeywords).toContain('mountain');
    });

    it('extracts accurate PNG dimensions and SHA-256 via MediaProbeService', async () => {
      const probe = new MediaProbeService();
      // 1x1 PNG in temp location
      const tmpPng = path.resolve(process.cwd(), 'test_probe_sample.png');
      const pngBytes = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
        'hex'
      );
      await fs.promises.writeFile(tmpPng, pngBytes);
      try {
        const meta = await probe.extractMetadata(tmpPng, 'image', 'probe_test_id');
        expect(meta.width).toBe(1);
        expect(meta.height).toBe(1);
        expect(meta.sha256Hash.length).toBe(64);
        expect(meta.perceptualHash.length).toBe(16);
      } finally {
        if (fs.existsSync(tmpPng)) await fs.promises.unlink(tmpPng);
      }
    });

    it('completes Travel Montage and Vertical Product Ad scenarios', async () => {
      const travelRes = await request(app)
        .post('/api/v1/storyboards/generate')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          prompt: 'Create a 30-second travel montage using beach, mountain, bicycle, and sunset footage.',
          targetDuration: 30,
          aspectRatio: '16:9'
        });
      expect(travelRes.status).toBe(201);
      expect(travelRes.body.data.storyboard.scenes.length).toBeGreaterThanOrEqual(3);

      const productRes = await request(app)
        .post('/api/v1/storyboards/generate')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          prompt: 'Create a 20-second vertical product advertisement showcase for modern studio hardware.',
          targetDuration: 20,
          aspectRatio: '9:16'
        });
      expect(productRes.status).toBe(201);
      expect(productRes.body.data.storyboard.aspectRatio).toBe('9:16');
    });

    it('parses SRT and VTT subtitle cues into accurate timestamps', () => {
      const probe = new MediaProbeService();
      const srt = `1
00:00:02,500 --> 00:00:06,000
Look at Max jumping into the pool!

2
00:00:07,000 --> 00:00:11,250
<b>What a massive splash!</b>`;

      const cues = probe.parseSrtOrVttContent(srt);
      expect(cues.length).toBe(2);
      expect(cues[0].startTime).toBe(2.5);
      expect(cues[0].endTime).toBe(6);
      expect(cues[0].text).toBe('Look at Max jumping into the pool!');
      expect(cues[1].text).toBe('What a massive splash!');
    });

    it('supports cursor pagination, job retry, HTTP Range streaming, and cross-user thumbnail protection', async () => {
      // 1. Cursor pagination
      const page1 = await request(app)
        .get('/api/v1/media?limit=10')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(page1.status).toBe(200);
      expect(page1.body.data.pagination.nextCursor).toBeTruthy();

      const page2 = await request(app)
        .get(`/api/v1/media?limit=10&cursor=${page1.body.data.pagination.nextCursor}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(page2.status).toBe(200);
      expect(page2.body.data.items.length).toBe(10);
      expect(page2.body.data.items[0].id).not.toBe(page1.body.data.items[0].id);

      // 2. Upload real file & verify Range streaming + Job list + Retry + Cross-user block
      const fakeMp4 = Buffer.from('00000018667479706d703432000000006d70343269736f6d000000206d646174', 'hex');
      const uploadRes = await request(app)
        .post('/api/v1/media/upload')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('files', fakeMp4, { filename: 'range_check.mp4', contentType: 'video/mp4' });
      expect(uploadRes.status).toBe(201);
      const uploadedId = uploadRes.body.data.assets[0].id;
      const jobId = uploadRes.body.data.jobs[0].id;

      const rangeRes = await request(app)
        .get(`/api/v1/media/${uploadedId}/stream`)
        .set('Authorization', `Bearer ${userAToken}`)
        .set('Range', 'bytes=0-15');
      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers['content-range']).toContain('bytes 0-15/');

      // Cross-user thumbnail & stream isolation check
      const stolenThumb = await request(app)
        .get(`/api/v1/media/${uploadedId}/thumbnail`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(stolenThumb.status).toBe(404);

      const retryRes = await request(app)
        .post(`/api/v1/jobs/${jobId}/retry`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(retryRes.status).toBe(200);
      expect(retryRes.body.data.job.status).toBe('queued');
    });
  });
});
