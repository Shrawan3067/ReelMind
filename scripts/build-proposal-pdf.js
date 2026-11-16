const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SUBMISSION_DIR = path.join(ROOT, 'submission');
const MD_OUT = path.join(ROOT, 'docs', 'HACKATHON_PROPOSAL.md');
const PDF_OUT = path.join(SUBMISSION_DIR, 'ReelMind_Project_Proposal.pdf');
const HTML_TMP = path.join('/tmp', 'reelmind-proposal.html');
const CHROME_PROFILE_TMP = path.join('/tmp', 'chrome-pdf-profile');
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_PDF_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_SUBSTANTIVE_WORDS = 500;

const QUESTIONS = [
  {
    num: 1,
    question: 'One sentence: What does the Skill do?',
    answer:
      'ReelMind turns authorized UGREEN AI NAS media libraries into natural-language scene search, ranked storyboards, and platform publishing kits without modifying originals.'
  },
  {
    num: 2,
    question: 'Who is the target user and problem?',
    answer:
      'Independent creators, videographers, families, and media teams archive thousands of unlabeled clips across NAS drives. Locating exact brief moments—such as a pet jumping into a pool—requires scrubbing hours of scattered folders before editing can even begin.'
  },
  {
    num: 3,
    question: 'What is your proposed solution?',
    answer:
      'ReelMind pairs an official Uliya Skill with a companion MERN studio (MongoDB, Express, React, Node.js). Natural-language requests trigger non-destructive NAS discovery, hybrid vector/lexical search, multi-factor clip ranking, strict timestamp-bounded storyboard assembly, interactive timeline refinement, and grounded social publishing copy generation.'
  },
  {
    num: 4,
    question: 'What is the Core User Flow?',
    answer:
      'Creators connect an authorized read-only UGOS share, then submit a prompt with target duration and aspect ratio. ReelMind searches scenes, ranks matches with explainable scores, compiles an editable timeline exporting JSON or CMX 3600 EDL, and drafts platform-ready titles, captions, and narration.'
  },
  {
    num: 5,
    question: 'What substantive difference does your idea offer compared with existing tools or conventional AI solutions?',
    answer:
      'Chatbots hallucinate filenames and timestamps, while cloud tools force uploading private terabytes. ReelMind operates NAS-first, isolates demo datasets, enforces bounded timestamps and contiguous timelines via Zod, attributes verifiable evidence (visual analysis, transcripts, metadata), and supports offline deterministic fallback.'
  },
  {
    num: 6,
    question: 'Which UGREEN AI NAS capabilities will be used, and at which step in the workflow?',
    answer:
      'Steps 1–2 use Uliya natural-language intent parsing, UGOS shared-folder ACLs, and read-only storage discovery. Steps 3–5 utilize NAS Docker hosting and optional local Ollama LLMs for private semantic embeddings, scene metadata indexing, clip ranking explanations, and EDL/JSON export while keeping media securely on-premises.'
  },
  {
    num: 7,
    question: 'What was your technical approach? Describe the planned Skill workflow, supported NAS CLI capabilities, expert agent orchestration, required inputs, permissions, AI model choices, and data handling, as applicable;',
    answer:
      'SKILL.md defines creative inputs (prompt, duration, aspect ratio, share path). Supported CLI capabilities remain strictly read-only: ls, find, stat, df, and ffprobe. Orchestration sequences six specialized agents (Intent, Discovery, Search, Ranking, Storyboard, Content). AI providers are runtime-swappable (Gemini, OpenAI, Anthropic, Ollama, local fallback). Keys are AES-256-GCM encrypted.'
  },
  {
    num: 8,
    question: 'What is the current development status? Identify what was implemented already, not yet implemented, or is pending NAS validation if selected to be a Finalist.',
    answer:
      'Implemented: complete Uliya Skill package, full-stack MERN studio, async FFprobe metadata indexing, hybrid search, six-factor clip ranking, timeline editor, CMX 3600 EDL export, and Content Studio. Not yet implemented: native UGOS App Center package, bundled Whisper ASR, and server-side MP4 rendering. Pending Finalist validation: live UGOS ACL verification, terabyte stress tests, and local Ollama benchmarks.'
  },
  {
    num: 9,
    question: 'What is your final validation plan? Name two core test cases and one edge case to validate if selected as a Finalist.',
    answer:
      'Core Case 1: Prompt "dog jumping into pool for 30s 16:9 reel" against 500 NAS clips verifies exact scene detection, contiguous timeline bounds, and CMX 3600 EDL export into DaVinci Resolve. Core Case 2: SHA-256 duplicate and quality audit across 1,000 raw files. Edge Case: Empty or offline NAS share reports unavailability honestly without fabricating clips.'
  },
  {
    num: 10,
    question: 'Are there any known limitations of your Project? Describe current known limitations, technical risks, and any external dependencies.',
    answer:
      'Dependencies: Node.js/MongoDB companion server, optional FFprobe, and user AI keys (unless running local Ollama). Technical risks: hardware variance across NAS CPU/RAM tiers during indexing. Limitations: final multi-track video rendering relies on importing EDLs into an NLE, and heuristic fallback yields lower semantic recall than neural models.'
  }
];

const THIRD_PARTY = [
  ['React & React DOM', 'https://github.com/facebook/react', 'MIT'],
  ['Vite & Tailwind CSS', 'https://github.com/vitejs/vite | tailwindcss.com', 'MIT'],
  ['Redux Toolkit, TanStack Query, React Router, Axios', 'npm OpenJS / Remix / TanStack', 'MIT'],
  ['Recharts, React Hook Form, Lucide React', 'npm / lucide.dev', 'MIT / ISC'],
  ['TypeScript', 'https://github.com/microsoft/TypeScript', 'Apache-2.0'],
  ['Express.js, Mongoose, Socket.IO, Zod, Pino, Multer', 'npm OpenJS / colinhacks', 'MIT'],
  ['bcryptjs, jsonwebtoken, Helmet, CORS, Express-Rate-Limit', 'npm ExpressJS ecosystem', 'MIT / BSD-2-Clause'],
  ['MongoDB Community (external runtime)', 'https://www.mongodb.com/try/download/community', 'SSPL-1.0'],
  ['FFmpeg / FFprobe (optional external CLI)', 'https://ffmpeg.org', 'LGPL-2.1+ / GPL-2.0+'],
  ['Vitest, Testing Library, JSDOM, Supertest, Playwright (dev)', 'npm test ecosystem', 'MIT / Apache-2.0'],
  ['Optional AI Providers & Dev Coding Assistants', 'Google Gemini / OpenAI / Anthropic / Ollama / Antigravity', 'Commercial / MIT (Ollama)']
];

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const totalAnswerWords = QUESTIONS.reduce((sum, q) => sum + countWords(q.answer), 0);
const totalPromptPlusAnswerWords = QUESTIONS.reduce(
  (sum, q) => sum + countWords(q.question) + countWords(q.answer),
  0
);

console.log(`Substantive answers word count: ${totalAnswerWords} / ${MAX_SUBSTANTIVE_WORDS}`);
console.log(`Questions + answers word count: ${totalPromptPlusAnswerWords}`);
if (totalAnswerWords > MAX_SUBSTANTIVE_WORDS) {
  throw new Error(`Proposal answers exceed 500-word limit (${totalAnswerWords} words)`);
}

// 1. Write synced Markdown file to docs/HACKATHON_PROPOSAL.md
const mdLines = [
  '# ReelMind Studio — Hackathon Project Proposal',
  '**Skill Name:** `reelmind-studio` | **Track:** UGREEN AI NAS Hackathon',
  '',
  '---',
  '',
  ...QUESTIONS.flatMap(q => [`### ${q.num}. ${q.question}`, q.answer, '']),
  '---',
  '',
  '## Third-Party Components & Licenses *(Excluded from 500-word limit)*',
  '| Component | Source | License |',
  '| :--- | :--- | :--- |',
  ...THIRD_PARTY.map(([name, src, lic]) => `| ${name} | ${src} | ${lic} |`),
  '',
  '## Team Consent Declaration & Signatures *(Excluded from 500-word limit)*',
  'We confirm that the submitted Skill workflow (`skills/reelmind-studio`) and core ReelMind architecture were newly developed during this Hackathon in compliance with official competition guidelines, privacy rules, and open-source licensing disclosures.',
  '',
  '| Team Member Name | Role | Consent | Electronic Signature | Date |',
  '| :--- | :--- | :--- | :--- | :--- |',
  '| [Member 1 Full Name] | Architecture & Backend | Agreed | `/s/ [Member 1 Name]` | YYYY-MM-DD |',
  '| [Member 2 Full Name] | Frontend & UX (optional) | Agreed | `/s/ [Member 2 Name]` | YYYY-MM-DD |',
  ''
];
fs.writeFileSync(MD_OUT, mdLines.join('\n'), 'utf8');
console.log(`✓ Updated ${MD_OUT}`);

// 2. Build clean HTML and compile vector PDF <= 1 MB via Chrome headless
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ReelMind — Hackathon Project Proposal</title>
  <style>
    @page {
      size: letter;
      margin: 0.52in 0.58in;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      font-size: 9.4pt;
      line-height: 1.42;
      margin: 0;
    }
    header {
      border-bottom: 2px solid #2563EB;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    h1 {
      font-size: 16pt;
      margin: 0;
      color: #0F172A;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 8.6pt;
      color: #2563EB;
      font-weight: 700;
      margin-top: 2px;
      white-space: nowrap;
    }
    .meta {
      text-align: right;
      font-size: 8pt;
      color: #475569;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 7px;
    }
    .qa {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 3px solid #2563EB;
      border-radius: 5px;
      padding: 6px 9px;
      break-inside: avoid;
    }
    .q {
      font-weight: 700;
      font-size: 8.8pt;
      color: #1E3A8A;
      margin-bottom: 2px;
    }
    .a {
      margin: 0;
      color: #1E293B;
      font-size: 8.9pt;
    }
    h2 {
      font-size: 10.5pt;
      color: #0F172A;
      border-bottom: 1px solid #CBD5E1;
      padding-bottom: 3px;
      margin: 13px 0 6px;
      break-after: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 10px;
      break-inside: avoid;
    }
    th, td {
      border: 1px solid #CBD5E1;
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #F1F5F9;
      color: #0F172A;
      font-weight: 700;
    }
    .consent {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 5px;
      padding: 8px 10px;
      font-size: 8.3pt;
      break-inside: avoid;
    }
    .consent p {
      margin: 0 0 7px;
      color: #334155;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>ReelMind Studio — Project Proposal</h1>
      <div class="subtitle">Skill Name: reelmind-studio &bull; Autonomous AI Video Director for UGREEN AI NAS</div>
    </div>
    <div class="meta">
      UGREEN AI NAS Hackathon<br />
      Substantive Responses: ${totalAnswerWords} words (&le; 500 limit)
    </div>
  </header>

  <section class="grid">
    ${QUESTIONS.map(
      q => `
      <div class="qa">
        <div class="q">${q.num}. ${q.question}</div>
        <p class="a">${q.answer}</p>
      </div>`
    ).join('')}
  </section>

  <h2>Third-Party Components &amp; Applicable Licenses</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 34%;">Component / Package</th>
        <th style="width: 44%;">Upstream Source</th>
        <th style="width: 22%;">License</th>
      </tr>
    </thead>
    <tbody>
      ${THIRD_PARTY.map(
        ([name, src, lic]) => `<tr><td>${name}</td><td>${src}</td><td><strong>${lic}</strong></td></tr>`
      ).join('')}
    </tbody>
  </table>

  <h2>Team Consent Declaration &amp; Electronic Signatures</h2>
  <div class="consent">
    <p>
      We declare that our submitted Uliya Skill (<code>reelmind-studio</code>) and core ReelMind orchestration
      pipeline were newly developed during this Hackathon without reusing prior standalone Skills, in full compliance
      with competition rules, UGREEN UGOS safety boundaries, and open-source licensing disclosures.
    </p>
    <table style="margin-bottom: 0;">
      <thead>
        <tr>
          <th style="width: 28%;">Team Member Name</th>
          <th style="width: 24%;">Role</th>
          <th style="width: 12%;">Consent</th>
          <th style="width: 22%;">Electronic Signature</th>
          <th style="width: 14%;">Date</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>[Enter Full Name]</td>
          <td>Project Lead / Developer</td>
          <td>Agreed</td>
          <td>/s/ [Electronic Signature]</td>
          <td>[YYYY-MM-DD]</td>
        </tr>
        <tr>
          <td>[Optional Teammate]</td>
          <td>Contributor</td>
          <td>Agreed</td>
          <td>/s/ [Electronic Signature]</td>
          <td>[YYYY-MM-DD]</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;

fs.mkdirSync(SUBMISSION_DIR, { recursive: true });
fs.mkdirSync(CHROME_PROFILE_TMP, { recursive: true });
fs.writeFileSync(HTML_TMP, html, 'utf8');

if (fs.existsSync(PDF_OUT)) fs.unlinkSync(PDF_OUT);

execFileSync(
  CHROME_BIN,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${CHROME_PROFILE_TMP}`,
    '--no-pdf-header-footer',
    `--print-to-pdf=${PDF_OUT}`,
    `file://${HTML_TMP}`
  ],
  { stdio: 'inherit' }
);

fs.rmSync(CHROME_PROFILE_TMP, { recursive: true, force: true });
fs.rmSync(HTML_TMP, { force: true });

const stat = fs.statSync(PDF_OUT);
if (stat.size > MAX_PDF_BYTES) {
  throw new Error(`Proposal PDF exceeds 1 MB limit: ${stat.size} bytes`);
}
console.log(`✓ Generated ${PDF_OUT} (${stat.size} bytes / ${(stat.size / 1024).toFixed(1)} KB)`);
