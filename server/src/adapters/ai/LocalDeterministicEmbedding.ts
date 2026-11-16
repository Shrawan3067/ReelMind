/**
 * Deterministic 128-dimensional local semantic vector encoder.
 * Maps text tokens, bigrams, and curated visual-concept synonyms into a unit-normalized
 * L2 vector so cosine similarity works consistently offline and when external embedding
 * APIs are unconfigured or rate-limited.
 */
const DIMENSION = 128;

const SYNONYM_GROUPS: Array<string[]> = [
  ['dog', 'puppy', 'retriever', 'labrador', 'canine', 'pet', 'animal'],
  ['pool', 'swimming', 'water', 'splash', 'dive', 'diving', 'swim', 'wet'],
  ['jump', 'jumping', 'leap', 'leaping', 'pounce', 'launch', 'airborne'],
  ['beach', 'ocean', 'sea', 'sand', 'coast', 'coastal', 'shore', 'waves', 'surf'],
  ['sunset', 'sunrise', 'dusk', 'dawn', 'golden', 'twilight', 'horizon'],
  ['mountain', 'alpine', 'peak', 'ridge', 'hiking', 'trail', 'valley', 'cliff'],
  ['bicycle', 'bike', 'cycling', 'cyclist', 'riding', 'wheels', 'boardwalk'],
  ['laugh', 'laughing', 'smile', 'smiling', 'happy', 'joy', 'fun', 'friends'],
  ['car', 'sports car', 'driving', 'vehicle', 'highway', 'road', 'red'],
  ['aerial', 'drone', 'sky', 'flying', 'overview', 'birds eye', 'cinematic'],
  ['speak', 'speaking', 'talk', 'talking', 'interview', 'voice', 'presenter'],
  ['product', 'commercial', 'advertisement', 'ad', 'unboxing', 'studio', 'showcase', 'hardware', 'nas']
];

const TOKEN_TO_CANONICAL = new Map<string, string[]>();
for (let g = 0; g < SYNONYM_GROUPS.length; g++) {
  const group = SYNONYM_GROUPS[g];
  const groupTag = `__concept_${g}`;
  for (const term of group) {
    const existing = TOKEN_TO_CANONICAL.get(term) || [];
    existing.push(groupTag);
    TOKEN_TO_CANONICAL.set(term, existing);
  }
}

function fnv1aHash(str: string, seed = 2166136261): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function computeLocalEmbedding(text: string): number[] {
  const vec = new Array<number>(DIMENSION).fill(0);
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  if (!cleaned) {
    return vec;
  }

  const rawTokens = cleaned.split(/\s+/).filter(t => t.length > 1);
  const expandedTokens: string[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];
    expandedTokens.push(tok);

    const concepts = TOKEN_TO_CANONICAL.get(tok);
    if (concepts) {
      for (const c of concepts) {
        expandedTokens.push(c);
        expandedTokens.push(c); // higher weight for canonical concept clusters
      }
    }

    if (i < rawTokens.length - 1) {
      const bigram = `${tok} ${rawTokens[i + 1]}`;
      expandedTokens.push(bigram);
      const bigramConcepts = TOKEN_TO_CANONICAL.get(bigram);
      if (bigramConcepts) {
        for (const c of bigramConcepts) {
          expandedTokens.push(c);
          expandedTokens.push(c);
        }
      }
    }
  }

  for (const token of expandedTokens) {
    const idx = fnv1aHash(token) % DIMENSION;
    const sign = (fnv1aHash(token, 1337) & 1) === 0 ? 1 : -1;
    vec[idx] += sign * (token.startsWith('__concept_') ? 1.8 : 1.0);
  }

  // L2 Normalize
  let normSq = 0;
  for (let i = 0; i < DIMENSION; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  if (norm > 0) {
    for (let i = 0; i < DIMENSION; i++) {
      vec[i] = Number((vec[i] / norm).toFixed(6));
    }
  }

  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  // Map [-1, 1] or [0, 1] into clamped [0, 1] similarity score
  return Math.max(0, Math.min(1, dot / denom));
}

