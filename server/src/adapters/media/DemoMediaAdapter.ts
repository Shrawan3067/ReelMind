import { MediaSourceAdapter, DiscoveredMediaDescriptor } from './MediaSourceAdapter';

export interface DemoSceneBlueprint {
  startTime: number;
  endTime: number;
  description: string;
  detectedObjects: string[];
  detectedActions: string[];
  transcript?: string;
  confidence: number;
}

export interface DemoAssetBlueprint extends DiscoveredMediaDescriptor {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  tags: string[];
  summary: string;
  themeColor: string;
  scenes: DemoSceneBlueprint[];
}

export class DemoMediaAdapter implements MediaSourceAdapter {
  public readonly sourceType = 'demo' as const;

  public async discoverMedia(_ownerId: string): Promise<DiscoveredMediaDescriptor[]> {
    return this.getDemoDatasetBlueprints();
  }

  public async getConnectionStatus() {
    return {
      connected: true,
      status: 'connected' as const,
      message: 'Isolated Demo Media Library active (DEMO DATA — not real NAS storage)'
    };
  }

  public async validateStorageReference(storageReference: string): Promise<boolean> {
    return storageReference.startsWith('demo://');
  }

  /**
   * Generates deterministic, clearly-labeled DEMO SVG thumbnails for demo media items
   * so all 150 demo assets render crisp visual previews without external network dependencies.
   */
  public renderDemoThumbnailSvg(title: string, category: string, color: string, durationSec: number): string {
    const safeTitle = title.replace(/[<>&"']/g, '');
    const safeCat = category.replace(/[<>&"']/g, '');
    const mins = Math.floor(durationSec / 60);
    const secs = Math.floor(durationSec % 60);
    const timeStr = durationSec > 0 ? `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : 'IMAGE';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B0F19"/>
      <stop offset="55%" stop-color="${color}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <circle cx="540" cy="70" r="90" fill="${color}" opacity="0.14"/>
  <circle cx="110" cy="290" r="120" fill="#06B6D4" opacity="0.1"/>
  <rect x="24" y="24" width="118" height="26" rx="6" fill="#F59E0B" opacity="0.92"/>
  <text x="83" y="41" font-family="'Poppins', system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#090B10" text-anchor="middle" letter-spacing="0.8">DEMO DATA</text>
  <rect x="528" y="24" width="88" height="26" rx="6" fill="#090B10" fill-opacity="0.75" stroke="${color}" stroke-opacity="0.6"/>
  <text x="572" y="41" font-family="monospace" font-size="12" font-weight="600" fill="#F8FAFC" text-anchor="middle">${timeStr}</text>
  <rect x="24" y="254" width="592" height="82" rx="12" fill="#090B10" fill-opacity="0.72" stroke="#FFFFFF" stroke-opacity="0.08"/>
  <text x="42" y="286" font-family="'Poppins', system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#F8FAFC">${safeTitle.slice(0, 44)}</text>
  <text x="42" y="314" font-family="'Poppins', system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Category: ${safeCat} • Synthetic Sample Asset</text>
  <rect x="42" y="294" width="48" height="3" rx="1.5" fill="url(#accent)" opacity="0"/>
</svg>`;
  }

  /**
   * Produces a rich 150-asset demo library (100 videos + 50 images) anchored around
   * the 3 signature scenarios:
   * A) Dog swimming pool cinematic video
   * B) Travel montage (beach, mountain, sunset, bicycle)
   * C) Product advertisement footage
   */
  public getDemoDatasetBlueprints(): DemoAssetBlueprint[] {
    const assets: DemoAssetBlueprint[] = [];

    // Scenario A: Dog Swimming Pool Signature Clips (12 core high-signal videos)
    const dogPoolClips: Array<{
      filename: string;
      duration: number;
      summary: string;
      tags: string[];
      scenes: DemoSceneBlueprint[];
    }> = [
      {
        filename: 'dog_pool_01.mp4',
        duration: 28,
        summary: 'Golden retriever trotting across sunny backyard patio approaching the swimming pool.',
        tags: ['dog', 'golden retriever', 'swimming pool', 'summer', 'backyard'],
        scenes: [
          {
            startTime: 0,
            endTime: 12,
            description: 'Wide shot of backyard garden patio in bright summer sunlight.',
            detectedObjects: ['patio', 'lounge chair', 'garden'],
            detectedActions: ['camera panning'],
            confidence: 0.91
          },
          {
            startTime: 12,
            endTime: 22,
            description: 'Golden retriever excitedly approaching the edge of the swimming pool, wagging tail.',
            detectedObjects: ['dog', 'golden retriever', 'swimming pool', 'water'],
            detectedActions: ['walking', 'approaching pool', 'wagging tail'],
            transcript: 'Look at Max heading right for the pool!',
            confidence: 0.96
          },
          {
            startTime: 22,
            endTime: 28,
            description: 'Dog looking down at shimmering blue pool water.',
            detectedObjects: ['dog', 'swimming pool'],
            detectedActions: ['looking down'],
            confidence: 0.92
          }
        ]
      },
      {
        filename: 'dog_pool_02.mp4',
        duration: 36,
        summary: 'Dog crouching playfully at the pool coping, preparing to leap for a yellow tennis ball.',
        tags: ['dog', 'poolside', 'tennis ball', 'jump preparation', 'summer'],
        scenes: [
          {
            startTime: 0,
            endTime: 24,
            description: 'Owner tossing a yellow tennis ball across the blue swimming pool surface.',
            detectedObjects: ['tennis ball', 'person', 'swimming pool'],
            detectedActions: ['throwing ball'],
            transcript: 'Ready, set, go fetch it!',
            confidence: 0.89
          },
          {
            startTime: 24,
            endTime: 36,
            description: 'Dog preparing to jump from the tile edge of the pool, ears perked forward.',
            detectedObjects: ['dog', 'swimming pool', 'pool tile'],
            detectedActions: ['crouching', 'preparing to jump'],
            confidence: 0.95
          }
        ]
      },
      {
        filename: 'dog_pool_03.mp4',
        duration: 22,
        summary: 'Action shot of golden retriever jumping mid-air into the swimming pool with dramatic splash.',
        tags: ['dog', 'jumping', 'swimming pool', 'splash', 'action', 'cinematic'],
        scenes: [
          {
            startTime: 0,
            endTime: 5,
            description: 'Dog launching off the pool deck.',
            detectedObjects: ['dog', 'pool deck'],
            detectedActions: ['leaping'],
            confidence: 0.93
          },
          {
            startTime: 5,
            endTime: 15,
            description: 'Dog jumping into the swimming pool mid-air and crashing into sparkling water with huge splash.',
            detectedObjects: ['dog', 'swimming pool', 'water splash'],
            detectedActions: ['jumping into pool', 'splashing'],
            transcript: 'Whoa, what a splash!',
            confidence: 0.98
          },
          {
            startTime: 15,
            endTime: 22,
            description: 'Underwater bubbles rising as the dog surfaces happily.',
            detectedObjects: ['dog', 'water', 'bubbles'],
            detectedActions: ['surfacing', 'swimming'],
            confidence: 0.91
          }
        ]
      },
      {
        filename: 'dog_pool_04.mp4',
        duration: 55,
        summary: 'Happy dog swimming laps, shaking off droplets in slow sunlight, playing in the water.',
        tags: ['dog', 'swimming', 'playing in water', 'summer', 'pool'],
        scenes: [
          {
            startTime: 0,
            endTime: 38,
            description: 'Dog paddling calmly across turquoise pool water holding a floating toy.',
            detectedObjects: ['dog', 'pool float', 'water'],
            detectedActions: ['swimming', 'paddling'],
            confidence: 0.92
          },
          {
            startTime: 38,
            endTime: 55,
            description: 'Dog playing in the water near the shallow steps, splashing playfully.',
            detectedObjects: ['dog', 'swimming pool', 'water droplets'],
            detectedActions: ['playing in water', 'splashing'],
            transcript: 'Good boy! Best summer day ever.',
            confidence: 0.95
          }
        ]
      },
      {
        filename: 'dog_pool_dock_dive_05.mp4',
        duration: 18,
        summary: 'Labrador running along poolside grass and leaping cleanly into crystal clear swimming pool.',
        tags: ['dog', 'labrador', 'jumping', 'swimming pool', 'dive'],
        scenes: [
          {
            startTime: 2,
            endTime: 12,
            description: 'Labrador sprinting and jumping into the swimming pool from the grassy side.',
            detectedObjects: ['dog', 'labrador', 'swimming pool', 'grass'],
            detectedActions: ['running', 'jumping into pool'],
            confidence: 0.96
          }
        ]
      },
      {
        filename: 'dog_shake_slowmo_06.mp4',
        duration: 16,
        summary: 'Close-up backlit shot of wet dog shaking water droplets off coat beside the pool.',
        tags: ['dog', 'water droplets', 'backlit', 'poolside', 'golden hour'],
        scenes: [
          {
            startTime: 3,
            endTime: 13,
            description: 'Wet golden retriever shaking water spray in golden afternoon light beside the swimming pool.',
            detectedObjects: ['dog', 'water droplets', 'swimming pool'],
            detectedActions: ['shaking off water'],
            confidence: 0.94
          }
        ]
      }
    ];

    for (const clip of dogPoolClips) {
      assets.push({
        sourceType: 'demo',
        filename: clip.filename,
        originalFilename: clip.filename,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageReference: `demo://videos/${clip.filename}`,
        fileSize: Math.round(clip.duration * 2_450_000),
        duration: clip.duration,
        width: 3840,
        height: 2160,
        frameRate: 60,
        isDemoData: true,
        tags: clip.tags,
        summary: clip.summary,
        themeColor: '#06B6D4',
        scenes: clip.scenes
      });
    }

    // Scenario B: Travel Montage (Beach, Mountain, Sunset, Bicycle, Aerial) - 18 core videos
    const travelClips: Array<{
      filename: string;
      duration: number;
      summary: string;
      tags: string[];
      color: string;
      scenes: DemoSceneBlueprint[];
    }> = [
      {
        filename: 'coastal_bicycle_ride_01.mp4',
        duration: 34,
        summary: 'Person riding a vintage cruiser bicycle along a palm-lined boardwalk next to the ocean beach.',
        tags: ['bicycle', 'beach', 'ocean', 'travel', 'coastal', 'cycling'],
        color: '#0EA5E9',
        scenes: [
          {
            startTime: 4,
            endTime: 18,
            description: 'Person riding a bicycle along the sandy beach boardwalk with crashing ocean waves.',
            detectedObjects: ['bicycle', 'person', 'beach', 'ocean', 'palm trees'],
            detectedActions: ['riding a bicycle', 'cycling'],
            confidence: 0.97
          },
          {
            startTime: 18,
            endTime: 32,
            description: 'Tracking side shot of bicycle wheels spinning past golden shoreline.',
            detectedObjects: ['bicycle', 'beach', 'ocean'],
            detectedActions: ['riding a bicycle'],
            confidence: 0.92
          }
        ]
      },
      {
        filename: 'golden_sunset_cliffs_02.mp4',
        duration: 42,
        summary: 'Cinematic aerial drone shot sweeping over coastal cliffs during fiery orange sunset.',
        tags: ['sunset', 'aerial', 'drone', 'ocean', 'cinematic', 'travel'],
        color: '#F59E0B',
        scenes: [
          {
            startTime: 0,
            endTime: 22,
            description: 'Cinematic aerial shot gliding over sunlit ocean water toward dramatic cliffs at sunset.',
            detectedObjects: ['ocean', 'cliffs', 'sun', 'sky'],
            detectedActions: ['aerial flight', 'panning'],
            confidence: 0.96
          },
          {
            startTime: 22,
            endTime: 40,
            description: 'Warm orange sunset reflections shimmering across calm waves.',
            detectedObjects: ['sunset', 'ocean', 'waves'],
            detectedActions: ['waves crashing'],
            confidence: 0.94
          }
        ]
      },
      {
        filename: 'alpine_mountain_ridge_03.mp4',
        duration: 48,
        summary: 'Sweeping mountain ridge aerial vista above misty pine valleys at sunrise.',
        tags: ['mountain', 'aerial', 'travel', 'landscape', 'mist', 'cinematic'],
        color: '#3B82F6',
        scenes: [
          {
            startTime: 5,
            endTime: 25,
            description: 'Cinematic aerial shot revealing snow-dusted mountain peaks emerging from valley mist.',
            detectedObjects: ['mountain', 'pine forest', 'clouds', 'ridge'],
            detectedActions: ['aerial reveal'],
            confidence: 0.96
          }
        ]
      },
      {
        filename: 'friends_laughing_campfire_04.mp4',
        duration: 30,
        summary: 'Group of friends laughing around a warm beach campfire at dusk.',
        tags: ['people laughing', 'friends', 'beach', 'travel', 'campfire'],
        color: '#EC4899',
        scenes: [
          {
            startTime: 3,
            endTime: 19,
            description: 'People laughing heartily together around a glowing beach bonfire at twilight.',
            detectedObjects: ['people', 'campfire', 'beach'],
            detectedActions: ['laughing', 'talking', 'smiling'],
            transcript: 'I cannot believe we actually made that trail climb before sundown!',
            confidence: 0.95
          }
        ]
      },
      {
        filename: 'red_sports_car_coast_05.mp4',
        duration: 26,
        summary: 'Red sports car winding smoothly along a scenic coastal highway overlooking the ocean.',
        tags: ['red sports car', 'car', 'highway', 'ocean', 'travel', 'driving'],
        color: '#EF4444',
        scenes: [
          {
            startTime: 2,
            endTime: 20,
            description: 'Tracking aerial shot of a glossy red sports car accelerating along coastal highway.',
            detectedObjects: ['red sports car', 'road', 'ocean', 'cliffs'],
            detectedActions: ['driving', 'cornering'],
            confidence: 0.97
          }
        ]
      }
    ];

    for (const clip of travelClips) {
      assets.push({
        sourceType: 'demo',
        filename: clip.filename,
        originalFilename: clip.filename,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageReference: `demo://videos/${clip.filename}`,
        fileSize: Math.round(clip.duration * 2_800_000),
        duration: clip.duration,
        width: 3840,
        height: 2160,
        frameRate: 24,
        isDemoData: true,
        tags: clip.tags,
        summary: clip.summary,
        themeColor: clip.color,
        scenes: clip.scenes
      });
    }

    // Scenario C: Product Advertisement Footage (6 core videos)
    const productClips: Array<{
      filename: string;
      duration: number;
      summary: string;
      tags: string[];
      scenes: DemoSceneBlueprint[];
    }> = [
      {
        filename: 'nas_studio_unboxing_01.mp4',
        duration: 25,
        summary: 'Sleek brushed-aluminum AI NAS desktop unit rotating under dramatic studio rim lighting.',
        tags: ['product', 'advertisement', 'studio', 'tech', 'hardware', 'commercial'],
        scenes: [
          {
            startTime: 0,
            endTime: 14,
            description: 'Macro product showcase of minimalist metallic smart storage hardware on dark slate surface.',
            detectedObjects: ['hardware device', 'desk', 'LED indicator'],
            detectedActions: ['turntable rotation'],
            transcript: 'Engineered for creators who refuse to compromise on local privacy and speed.',
            confidence: 0.95
          }
        ]
      },
      {
        filename: 'creator_desk_workflow_02.mp4',
        duration: 32,
        summary: 'Filmmaker speaking to camera in modern studio while editing 4K timeline on ultrawide monitor.',
        tags: ['product', 'creator', 'speaking', 'studio', 'commercial', 'editing'],
        scenes: [
          {
            startTime: 4,
            endTime: 24,
            description: 'Creative director speaking enthusiastically about video workflow while reviewing footage.',
            detectedObjects: ['person', 'monitor', 'keyboard', 'camera'],
            detectedActions: ['speaking', 'pointing at screen', 'editing'],
            transcript: 'With instant semantic search across every terabyte, finding the exact hero shot takes seconds.',
            confidence: 0.96
          }
        ]
      },
      {
        filename: 'espresso_product_pour_03.mp4',
        duration: 19,
        summary: 'High-speed commercial shot of golden espresso pouring into crystal glass on dark marble.',
        tags: ['product', 'advertisement', 'commercial', 'macro', 'beverage'],
        scenes: [
          {
            startTime: 2,
            endTime: 15,
            description: 'Macro slow-motion shot of rich crema espresso pouring in warm studio lighting.',
            detectedObjects: ['espresso cup', 'coffee', 'marble counter'],
            detectedActions: ['pouring'],
            confidence: 0.94
          }
        ]
      }
    ];

    for (const clip of productClips) {
      assets.push({
        sourceType: 'demo',
        filename: clip.filename,
        originalFilename: clip.filename,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageReference: `demo://videos/${clip.filename}`,
        fileSize: Math.round(clip.duration * 3_100_000),
        duration: clip.duration,
        width: 3840,
        height: 2160,
        frameRate: 60,
        isDemoData: true,
        tags: clip.tags,
        summary: clip.summary,
        themeColor: '#3B82F6',
        scenes: clip.scenes
      });
    }

    // Fill remaining videos up to 100 total videos with varied real-world library categories
    const fillerVideoTemplates = [
      { prefix: 'beach_waves_morning', cat: 'Beach & Ocean', tags: ['beach', 'ocean', 'morning', 'travel'], color: '#06B6D4', desc: 'Gentle morning waves rolling over clean white sand beach.' },
      { prefix: 'sunset_timelapse_harbor', cat: 'Sunset', tags: ['sunset', 'harbor', 'boats', 'timelapse'], color: '#F59E0B', desc: 'Colorful sunset sky reflecting off harbor boats at dusk.' },
      { prefix: 'mountain_hiker_trail', cat: 'Mountains', tags: ['mountain', 'hiking', 'nature', 'travel'], color: '#10B981', desc: 'Hiker walking along high alpine trail overlooking green valley.' },
      { prefix: 'city_bicycle_commute', cat: 'Urban Cycling', tags: ['bicycle', 'city', 'street', 'person'], color: '#2563EB', desc: 'Cyclist riding a bicycle past sunlit cafe terraces.' },
      { prefix: 'family_picnic_laughing', cat: 'Lifestyle', tags: ['people laughing', 'park', 'family', 'summer'], color: '#0EA5E9', desc: 'Friends and family laughing together on a picnic blanket.' },
      { prefix: 'dog_park_fetch', cat: 'Pets', tags: ['dog', 'park', 'running', 'fetch'], color: '#14B8A6', desc: 'Playful puppy running across green park lawn chasing frisbee.' },
      { prefix: 'studio_interview_clip', cat: 'Interviews', tags: ['speaking', 'interview', 'person', 'studio'], color: '#3B82F6', desc: 'Guest speaker sharing creative insights in softbox lighting.' },
      { prefix: 'drone_waterfall_forest', cat: 'Aerial Nature', tags: ['aerial', 'waterfall', 'forest', 'cinematic'], color: '#22C55E', desc: 'Cinematic aerial shot soaring above lush waterfall canyon.' }
    ];

    let videoCount = assets.length;
    let idx = 1;
    while (videoCount < 100) {
      const tpl = fillerVideoTemplates[idx % fillerVideoTemplates.length];
      const numStr = String(idx).padStart(3, '0');
      const filename = `${tpl.prefix}_${numStr}.mp4`;
      const duration = 14 + ((idx * 7) % 45);
      const isLowRes = idx % 19 === 0; // Give realistic variation for quality report!
      const width = isLowRes ? 854 : idx % 3 === 0 ? 3840 : 1920;
      const height = isLowRes ? 480 : idx % 3 === 0 ? 2160 : 1080;

      assets.push({
        sourceType: 'demo',
        filename,
        originalFilename: filename,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageReference: `demo://videos/${filename}`,
        fileSize: Math.round(duration * (isLowRes ? 600_000 : 1_850_000)),
        duration,
        width,
        height,
        frameRate: idx % 2 === 0 ? 30 : 60,
        isDemoData: true,
        tags: tpl.tags,
        summary: `${tpl.desc} (Sample clip #${numStr})`,
        themeColor: tpl.color,
        scenes: [
          {
            startTime: 0,
            endTime: Math.min(duration, 12),
            description: tpl.desc,
            detectedObjects: tpl.tags.slice(0, 3),
            detectedActions: [tpl.tags[0]],
            confidence: 0.85
          }
        ]
      });
      videoCount++;
      idx++;
    }

    // Add 50 demo images covering photography stills across all themes
    const imageThemes = [
      { prefix: 'dog_poolside_still', tags: ['dog', 'swimming pool', 'photo'], color: '#06B6D4', desc: 'High-resolution photograph of golden retriever beside swimming pool.' },
      { prefix: 'beach_sunset_panorama', tags: ['beach', 'sunset', 'ocean', 'travel'], color: '#F59E0B', desc: 'Vibrant sunset horizon photo over tropical sandy beach.' },
      { prefix: 'mountain_peak_alpenglow', tags: ['mountain', 'sunrise', 'landscape'], color: '#3B82F6', desc: 'Crisp mountain peak bathed in pink morning alpenglow.' },
      { prefix: 'product_hero_flatlay', tags: ['product', 'studio', 'advertisement'], color: '#2563EB', desc: 'Studio flatlay photography of creator gear and smart NAS hardware.' },
      { prefix: 'bicycle_boardwalk_frame', tags: ['bicycle', 'beach', 'summer'], color: '#0EA5E9', desc: 'Parked retro cruiser bicycle leaning near ocean boardwalk.' }
    ];

    for (let i = 1; i <= 50; i++) {
      const tpl = imageThemes[i % imageThemes.length];
      const numStr = String(i).padStart(2, '0');
      const ext = i % 2 === 0 ? 'jpg' : 'png';
      const filename = `${tpl.prefix}_${numStr}.${ext}`;

      assets.push({
        sourceType: 'demo',
        filename,
        originalFilename: filename,
        mimeType: ext === 'jpg' ? 'image/jpeg' : 'image/png',
        mediaType: 'image',
        storageReference: `demo://images/${filename}`,
        fileSize: 2_400_000 + (i * 45_000),
        duration: 0,
        width: 4000,
        height: 2667,
        frameRate: 0,
        isDemoData: true,
        tags: tpl.tags,
        summary: `${tpl.desc} (Still #${numStr})`,
        themeColor: tpl.color,
        scenes: [
          {
            startTime: 0,
            endTime: 0,
            description: tpl.desc,
            detectedObjects: tpl.tags,
            detectedActions: [],
            confidence: 0.9
          }
        ]
      });
    }

    return assets;
  }
}

