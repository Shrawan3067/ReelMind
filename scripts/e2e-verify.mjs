import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { createApp } = require('../server/dist/app.js');

const CLIENT_DIST = path.resolve(process.cwd(), 'client/dist');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME_MAP = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json'
};

function serveStaticSpa(req, res) {
  const urlPath = (req.url || '/').split('?')[0];
  let filePath = path.join(CLIENT_DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(CLIENT_DIST, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME_MAP[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

async function runE2E() {
  process.env.NODE_ENV = 'test';
  const systemMongod = '/usr/local/bin/mongod';
  const mongoServer = await MongoMemoryServer.create(
    fs.existsSync(systemMongod) ? { binary: { systemBinary: systemMongod } } : undefined
  );
  await mongoose.connect(mongoServer.getUri());

  const apiApp = createApp();
  const server = http.createServer((req, res) => {
    if (req.url && (req.url.startsWith('/api/') || req.url.startsWith('/socket.io/'))) {
      apiApp(req, res);
    } else {
      serveStaticSpa(req, res);
    }
  });

  await new Promise(resolve => server.listen(5088, '127.0.0.1', resolve));
  console.log('✓ Test full-stack server listening at http://127.0.0.1:5088');

  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
    headless: true
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push(err.message));

  try {
    const scratchDir = '/Users/mac/.gemini/antigravity/brain/f7299097-da27-4a8c-8dc0-42b30fbf70d9/scratch';
    fs.mkdirSync(scratchDir, { recursive: true });

    // 1. Landing Page
    await page.goto('http://127.0.0.1:5088/', { waitUntil: 'networkidle' });
    await page.getByText('Your Media Library Just Became Your').waitFor();
    const landingBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (landingBg !== 'rgb(9, 11, 16)') {
      throw new Error(`Expected unified dark theme body background rgb(9, 11, 16), got ${landingBg}`);
    }
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, 'landing-dark-desktop.png'), fullPage: false });
    console.log('✓ Step 1: Landing Page (Obsidian Studio Dark) rendered cleanly');

    // 2. Register new account
    await page.getByRole('link', { name: 'Start Creating' }).first().click();
    await page.getByPlaceholder('Alex Rivera').waitFor();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(scratchDir, 'auth-dark-desktop.png'), fullPage: false });

    await page.getByPlaceholder('Alex Rivera').fill('E2E Hackathon Judge');
    await page.getByPlaceholder('you@studio.com').fill('judge@reelmind.ai');
    await page.getByPlaceholder('••••••••').fill('ReelMindJudge2026!');
    await page.getByRole('button', { name: /Create Account/i }).click();

    await page.waitForURL('**/app/dashboard');
    await page.getByText('Creative Command Center').waitFor();
    console.log('✓ Step 2: Account registered and redirected to Dashboard');

    // 3. Load 150-Clip Isolated Demo Library
    await page.getByRole('button', { name: /Load 150-Clip Demo Library/i }).click();
    await page.getByText('150 Isolated DEMO Assets Indexed').waitFor({ timeout: 10000 });
    console.log('✓ Step 3: Seeded 150-clip DEMO DATA library from UI');

    // 4. AI Search Studio -> Search Dog Swimming Pool -> Generate Storyboard
    await page.getByRole('navigation').getByRole('link', { name: 'AI Search Studio' }).click();
    await page.waitForURL('**/app/search');
    await page.getByRole('button', { name: /Search Library/i }).click();
    await page.getByText('dog_pool_03.mp4').first().waitFor({ timeout: 10000 });
    while ((await page.getByLabel('Close notification').count()) > 0) {
      await page.getByLabel('Close notification').first().click();
    }
    await page.getByRole('button', { name: /Score details/i }).first().click();
    await page.getByRole('button', { name: /Select Clip/i }).first().click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, 'search-dark-desktop.png'), fullPage: false });
    await page.getByRole('button', { name: /Generate Storyboard/i }).click();

    // 5. Storyboard Studio Interactive Editing & Export
    await page.waitForURL('**/app/storyboard/**');
    await page.getByText('Interactive Storyboard Timeline').waitFor({ timeout: 10000 });
    while ((await page.getByLabel('Close notification').count()) > 0) {
      await page.getByLabel('Close notification').first().click();
    }
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, 'storyboard-dark-desktop.png'), fullPage: true });

    await page.getByRole('button', { name: '9:16' }).click();
    await page.getByRole('button', { name: /Export Plan/i }).click();
    await page.getByText(/Exported Production Plan/i).waitFor();
    await page.locator('pre').getByText('9:16').waitFor();
    await page.getByRole('button', { name: /Copy Plan/i }).waitFor();
    await page.getByLabel('Close export modal').click();
    console.log('✓ Step 4-5: AI Search -> Storyboard Generation -> Aspect Ratio 9:16 -> Export Plan verified');

    // 6. Content Studio
    await page.getByRole('link', { name: /Generate Titles & Social Copy/i }).click();
    await page.waitForURL('**/app/content?storyboardId=**');
    await page.getByText(/Anchored: Summer Pool Adventure/i).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /Generate Publishing Pack/i }).click();
    await page.getByText('Title Variations').waitFor({ timeout: 10000 });
    await page.getByText('Grounded in actual storyboard scenes').waitFor();
    await page.getByText('Scene-by-Scene Narration Script').waitFor();
    await page.getByRole('button', { name: /Export .MD/i }).waitFor();
    while ((await page.getByLabel('Close notification').count()) > 0) {
      await page.getByLabel('Close notification').first().click();
    }
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, 'content-dark-desktop.png'), fullPage: true });
    console.log('✓ Step 6: AI Content Studio grounded storyboard kit & preview verified');

    // 7. Media Library, Collections, Inspector & Quality Audit
    await page.getByRole('navigation').getByRole('link', { name: 'Media Library' }).click();
    await page.waitForURL('**/app/library');
    await page.getByText('dog_pool_01.mp4').first().waitFor({ timeout: 10000 });
    while ((await page.getByLabel('Close notification').count()) > 0) {
      await page.getByLabel('Close notification').first().click();
    }
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, 'library-dark-desktop.png'), fullPage: false });

    // Test collection filter & batch selection
    await page.getByRole('button', { name: /Dog Pool Clips/i }).click();
    await page.getByText('dog_pool_01.mp4').first().waitFor();
    await page.getByLabel('Select dog_pool_01.mp4').click();
    await page.getByText('1 selected').waitFor();
    await page.getByLabel('Clear selection').click();

    // Test Inspector modal & Duplicate Audit
    await page.getByText('dog_pool_01.mp4').first().click();
    await page.getByText('Indexed Scenes & Timestamps').waitFor({ timeout: 10000 });
    await page.getByLabel('Close inspector').click();

    await page.getByRole('button', { name: /Duplicate & Quality Audit/i }).click();
    await page.getByText('Exact & Perceptual Duplicate Groups').waitFor({ timeout: 10000 });
    console.log('✓ Step 7: Media Library (Collections, Selection, Inspector & Quality Audit) verified');

    // 8. Settings, Processing Center & Session Security
    await page.getByRole('link', { name: 'Processing Center' }).click();
    await page.waitForURL('**/app/processing');
    await page.getByText('Processing Center').first().waitFor();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(scratchDir, 'processing-dark-desktop.png'), fullPage: false });

    await page.getByRole('link', { name: 'Settings & NAS' }).click();
    await page.waitForURL('**/app/settings');
    await page.getByText('Active Sessions & Security').waitFor();
    await page.getByText('disconnected', { exact: false }).first().waitFor();
    await page.getByText('Obsidian Studio Dark').waitFor();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(scratchDir, 'settings-dark-desktop.png'), fullPage: false });
    console.log('✓ Step 8: Settings, Processing Center, Sessions & UGREEN NAS status verified');

    // 9. Desktop Dashboard + Mobile Viewport Responsiveness Check (390x844)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click();
    await page.waitForURL('**/app/dashboard');
    await page.getByText('Recent AI Storyboards & Projects').waitFor({ timeout: 10000 });
    while ((await page.getByLabel('Close notification').count()) > 0) {
      await page.getByLabel('Close notification').first().click();
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(scratchDir, 'dashboard-dark-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Open menu').click();
    await page.getByRole('navigation').getByRole('link', { name: 'Content Studio' }).click();
    await page.waitForURL('**/app/content');
    await page.getByText('AI Content Studio').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, 'content-mobile.png'), fullPage: false });

    await page.getByLabel('Open menu').click();
    await page.getByRole('navigation').getByRole('link', { name: 'Storyboard Studio' }).click();
    await page.waitForURL('**/app/storyboard**');
    await page.getByText('Interactive Storyboard Timeline').waitFor({ timeout: 10000 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, 'storyboard-mobile.png'), fullPage: false });

    await page.getByLabel('Open menu').click();
    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click();
    await page.waitForURL('**/app/dashboard');
    await page.getByText('Creative Command Center').waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(scratchDir, 'dashboard-mobile.png'), fullPage: false });
    console.log('✓ Step 9: Dark Studio Desktop + Mobile responsive checks verified (390x844)');

    if (consoleErrors.length > 0) {
      throw new Error(`Uncaught browser page errors: ${consoleErrors.join('; ')}`);
    }

    console.log('ALL E2E CHROME WORKFLOW CHECKS PASSED WITH ZERO CONSOLE ERRORS!');
  } finally {
    await browser.close();
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runE2E().catch(err => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});

