const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '../skills/reelmind-studio');
const OUT_DIR = path.resolve(__dirname, '../dist');
const SUBMISSION_DIR = path.resolve(__dirname, '../submission');
const ZIP_PATH = path.join(OUT_DIR, 'reelmind-studio-ugreen-skill.zip');
const SUBMISSION_ZIP_PATH = path.join(SUBMISSION_DIR, 'reelmind-studio-skill.zip');

const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB per file
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB package limit
const MAX_FILES = 100;

function validateSkillPackage() {
  console.log('Validating UGREEN Uliya Skill Package:', SKILL_DIR);

  const skillMdPath = path.join(SKILL_DIR, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error('Missing mandatory SKILL.md');
  }

  const content = fs.readFileSync(skillMdPath, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    throw new Error('SKILL.md missing required YAML frontmatter');
  }

  const frontmatter = fmMatch[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

  if (!nameMatch || !descMatch) {
    throw new Error('Frontmatter must specify both name and description');
  }

  const skillName = nameMatch[1].trim().replace(/^["']|["']$/g, '');
  const skillDesc = descMatch[1].trim().replace(/^["']|["']$/g, '');

  if (!/^[a-z0-9-]{2,64}$/.test(skillName)) {
    throw new Error(`Invalid skill name "${skillName}": must be lowercase hyphenated, 2-64 chars`);
  }
  if (skillDesc.length === 0 || skillDesc.length > 1024) {
    throw new Error(`Invalid description length (${skillDesc.length}): must be 1-1024 chars`);
  }

  // Collect all files and check extensions, size limits, and file count limits
  const allFiles = [];
  let totalUncompressedBytes = 0;

  function walkCheck(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkCheck(full);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== '.md') {
          throw new Error(`Unsupported file inside Uliya Skill package: ${full} (only Markdown files allowed)`);
        }
        const stat = fs.statSync(full);
        if (stat.size > MAX_FILE_BYTES) {
          throw new Error(`File exceeds 1 MB limit: ${full} (${stat.size} bytes)`);
        }
        totalUncompressedBytes += stat.size;
        allFiles.push(path.relative(SKILL_DIR, full).replace(/\\/g, '/'));
      }
    }
  }
  walkCheck(SKILL_DIR);

  if (allFiles.length > MAX_FILES) {
    throw new Error(`Package exceeds 100-file limit (${allFiles.length} files found)`);
  }
  if (totalUncompressedBytes > MAX_TOTAL_BYTES) {
    throw new Error(`Uncompressed package exceeds 10 MB limit (${totalUncompressedBytes} bytes)`);
  }

  // Verify every supporting Markdown file outside SKILL.md is directly linked from SKILL.md
  const linkedRefs = new Set();
  for (const m of content.matchAll(/\]\(([^)]+\.md)\)/g)) {
    const target = m[1].trim();
    const resolved = path.join(SKILL_DIR, target);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Broken reference link in SKILL.md: ${target}`);
    }
    linkedRefs.add(path.relative(SKILL_DIR, resolved).replace(/\\/g, '/'));
  }

  for (const rel of allFiles) {
    if (rel === 'SKILL.md') continue;
    if (!linkedRefs.has(rel)) {
      throw new Error(`Unlinked supporting file in Skill package: ${rel} (must be directly linked from SKILL.md)`);
    }
  }

  console.log(`✓ Verified Skill "${skillName}" (${skillDesc.length} chars)`);
  console.log(`✓ Verified ${allFiles.length} Markdown files (${totalUncompressedBytes} bytes uncompressed)`);
  console.log('✓ Zero separate manifests, scripts, binaries, or unlinked files');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SUBMISSION_DIR, { recursive: true });
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  if (fs.existsSync(SUBMISSION_ZIP_PATH)) fs.unlinkSync(SUBMISSION_ZIP_PATH);

  execFileSync('zip', ['-r', '-X', ZIP_PATH, 'SKILL.md', 'references'], {
    cwd: SKILL_DIR,
    stdio: 'inherit'
  });

  const zipStat = fs.statSync(ZIP_PATH);
  if (zipStat.size > MAX_TOTAL_BYTES) {
    throw new Error(`ZIP package exceeds 10 MB limit (${zipStat.size} bytes)`);
  }
  fs.copyFileSync(ZIP_PATH, SUBMISSION_ZIP_PATH);
  console.log(`✓ Submission ZIP (${zipStat.size} bytes) ready at:\n  - ${ZIP_PATH}\n  - ${SUBMISSION_ZIP_PATH}`);
}

validateSkillPackage();
