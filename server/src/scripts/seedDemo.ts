import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { UserModel } from '../models/User';
import { DemoSeedService } from '../services/media/DemoSeedService';
import { StoryboardService } from '../services/storyboard/StoryboardService';
import { logger } from '../config/logger';

async function seed() {
  await connectDatabase();

  const demoEmail = 'creator@reelmind.ai';
  let user = await UserModel.findOne({ email: demoEmail });

  if (!user) {
    const passwordHash = await bcrypt.hash('ReelMind2026!', 12);
    user = await UserModel.create({
      name: 'Alex Rivera (Demo Studio)',
      email: demoEmail,
      passwordHash,
      role: 'user',
      preferences: {
        theme: 'dark',
        defaultAspectRatio: '16:9',
        aiProvider: 'none',
        autoProcessUploads: true
      }
    });
    logger.info(`Created demo creator account: ${demoEmail} / ReelMind2026!`);
  }

  const seedService = new DemoSeedService();
  const res = await seedService.seedDemoLibraryForUser(user._id.toString());
  logger.info(res, 'Demo media library seeding result');

  // Generate 3 signature storyboards if none exist
  const sbService = new StoryboardService();
  await sbService.generateStoryboard(user._id.toString(), {
    prompt: 'Find every clip where the dog jumps into the swimming pool and create a 30-second cinematic video.',
    targetDuration: 30,
    aspectRatio: '16:9',
    includeDemoMedia: true
  });

  await sbService.generateStoryboard(user._id.toString(), {
    prompt: 'Create a 30-second travel montage using beach, mountain, bicycle, and sunset footage.',
    targetDuration: 30,
    aspectRatio: '16:9',
    includeDemoMedia: true
  });

  await sbService.generateStoryboard(user._id.toString(), {
    prompt: 'Create a 20-second vertical product advertisement showcase for modern studio hardware.',
    targetDuration: 20,
    aspectRatio: '9:16',
    includeDemoMedia: true
  });

  logger.info('Seeded 3 signature demo storyboards cleanly.');
  await disconnectDatabase();
}

seed().catch(err => {
  logger.error({ err }, 'Demo seeding failed');
  process.exit(1);
});

