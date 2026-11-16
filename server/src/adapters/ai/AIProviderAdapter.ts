import { ZodType } from 'zod';
import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { decryptSecret } from '../../utils/crypto';
import { computeLocalEmbedding } from './LocalDeterministicEmbedding';

export type AIProviderName = 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'none';

export interface AIProviderRuntimeConfig {
  provider: AIProviderName;
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
  baseUrl?: string;
}

export interface AICapabilities {
  provider: AIProviderName;
  configured: boolean;
  llmAvailable: boolean;
  visionAvailable: boolean;
  embeddingAvailable: boolean;
  model: string;
  embeddingModel: string;
}

export interface VisionFrameAnalysisResult {
  description: string;
  objects: string[];
  actions: string[];
  analyzedVisually: boolean;
}

export class AIProviderAdapter {
  private config: AIProviderRuntimeConfig;

  constructor(config?: Partial<AIProviderRuntimeConfig>) {
    this.config = {
      provider: config?.provider || env.AI_PROVIDER,
      apiKey: config?.apiKey || env.AI_API_KEY,
      model: config?.model || env.AI_MODEL,
      embeddingModel: config?.embeddingModel || env.EMBEDDING_MODEL,
      baseUrl: config?.baseUrl || env.AI_BASE_URL
    };
  }

  public static fromUserOrEnv(userAiConfig?: {
    provider?: AIProviderName;
    encryptedApiKey?: string;
    model?: string;
    embeddingModel?: string;
    baseUrl?: string;
  }): AIProviderAdapter {
    if (userAiConfig && userAiConfig.provider && userAiConfig.provider !== 'none') {
      let apiKey: string | undefined;
      if (userAiConfig.encryptedApiKey) {
        try {
          apiKey = decryptSecret(userAiConfig.encryptedApiKey);
        } catch {
          apiKey = undefined;
        }
      }
      return new AIProviderAdapter({
        provider: userAiConfig.provider,
        apiKey: apiKey || env.AI_API_KEY,
        model: userAiConfig.model || env.AI_MODEL,
        embeddingModel: userAiConfig.embeddingModel || env.EMBEDDING_MODEL,
        baseUrl: userAiConfig.baseUrl || env.AI_BASE_URL
      });
    }
    return new AIProviderAdapter();
  }

  public getCapabilities(): AICapabilities {
    const p = this.config.provider;
    const hasKey = Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0);
    const isOllama = p === 'ollama' && Boolean(this.config.baseUrl || 'http://localhost:11434');
    const configured = (p !== 'none' && hasKey) || isOllama;

    const defaultModels: Record<AIProviderName, string> = {
      openai: 'gpt-4o-mini',
      gemini: 'gemini-2.0-flash',
      anthropic: 'claude-3-5-sonnet-latest',
      ollama: 'llama3.2',
      none: 'deterministic-local-planner'
    };

    const defaultEmbedModels: Record<AIProviderName, string> = {
      openai: 'text-embedding-3-small',
      gemini: 'text-embedding-004',
      anthropic: 'local-tfidf-hash',
      ollama: 'nomic-embed-text',
      none: 'local-tfidf-hash'
    };

    return {
      provider: p,
      configured,
      llmAvailable: configured,
      visionAvailable: configured && (p === 'openai' || p === 'gemini' || p === 'anthropic'),
      embeddingAvailable: true, // Always available via provider API or deterministic local embedding
      model: this.config.model || defaultModels[p],
      embeddingModel: configured && p !== 'anthropic'
        ? (this.config.embeddingModel || defaultEmbedModels[p])
        : 'local-tfidf-hash'
    };
  }

  public async generateEmbedding(text: string): Promise<{ vector: number[]; model: string }> {
    const caps = this.getCapabilities();
    if (!caps.configured) {
      return { vector: computeLocalEmbedding(text), model: 'local-tfidf-hash' };
    }

    try {
      if (this.config.provider === 'openai' && this.config.apiKey) {
        const res = await fetch(`${this.config.baseUrl || 'https://api.openai.com/v1'}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify({
            model: caps.embeddingModel,
            input: text.slice(0, 8000)
          }),
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
          const emb = data.data?.[0]?.embedding;
          if (emb && emb.length > 0) {
            return { vector: emb, model: caps.embeddingModel };
          }
        }
      } else if (this.config.provider === 'gemini' && this.config.apiKey) {
        const modelName = caps.embeddingModel;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${this.config.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text: text.slice(0, 8000) }] }
          }),
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const data = (await res.json()) as { embedding?: { values: number[] } };
          if (data.embedding?.values?.length) {
            return { vector: data.embedding.values, model: modelName };
          }
        }
      } else if (this.config.provider === 'ollama') {
        const base = this.config.baseUrl || 'http://localhost:11434';
        const res = await fetch(`${base}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: caps.embeddingModel, prompt: text.slice(0, 4000) }),
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = (await res.json()) as { embedding?: number[] };
          if (data.embedding?.length) {
            return { vector: data.embedding, model: caps.embeddingModel };
          }
        }
      }
    } catch (error) {
      logger.warn({ err: error, provider: this.config.provider }, 'External embedding failed, falling back to local deterministic vector');
    }

    return { vector: computeLocalEmbedding(text), model: 'local-tfidf-hash' };
  }

  public async generateStructuredJson<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: ZodType<T>
  ): Promise<{ data: T | null; usedExternalLlm: boolean; error?: string }> {
    const caps = this.getCapabilities();
    if (!caps.configured) {
      return { data: null, usedExternalLlm: false };
    }

    try {
      let rawText = '';

      if (this.config.provider === 'openai' && this.config.apiKey) {
        const res = await fetch(`${this.config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify({
            model: caps.model,
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ]
          }),
          signal: AbortSignal.timeout(20000)
        });
        if (!res.ok) throw new Error(`OpenAI API returned ${res.status}`);
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        rawText = json.choices?.[0]?.message?.content || '';
      } else if (this.config.provider === 'gemini' && this.config.apiKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${caps.model}:generateContent?key=${this.config.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(20000)
        });
        if (!res.ok) throw new Error(`Gemini API returned ${res.status}`);
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (this.config.provider === 'anthropic' && this.config.apiKey) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: caps.model,
            max_tokens: 2048,
            system: `${systemPrompt}\nReturn valid JSON only.`,
            messages: [{ role: 'user', content: userPrompt }]
          }),
          signal: AbortSignal.timeout(20000)
        });
        if (!res.ok) throw new Error(`Anthropic API returned ${res.status}`);
        const json = (await res.json()) as { content?: Array<{ text?: string }> };
        rawText = json.content?.[0]?.text || '';
      } else if (this.config.provider === 'ollama') {
        const base = this.config.baseUrl || 'http://localhost:11434';
        const res = await fetch(`${base}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: caps.model,
            format: 'json',
            stream: false,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ]
          }),
          signal: AbortSignal.timeout(25000)
        });
        if (!res.ok) throw new Error(`Ollama API returned ${res.status}`);
        const json = (await res.json()) as { message?: { content?: string } };
        rawText = json.message?.content || '';
      }

      if (!rawText) {
        return { data: null, usedExternalLlm: true, error: 'Empty response from AI provider' };
      }

      const cleanedJson = rawText
        .replace(/^```json\s*/i, '')
        .replace(/```$/i, '')
        .trim();

      const parsed = JSON.parse(cleanedJson);
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        return {
          data: null,
          usedExternalLlm: true,
          error: `AI output schema validation failed: ${validated.error.message}`
        };
      }

      return { data: validated.data, usedExternalLlm: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AI provider failure';
      logger.warn({ err: error, provider: this.config.provider }, 'External LLM call failed');
      return { data: null, usedExternalLlm: true, error: message };
    }
  }

  public async analyzeImageBase64(
    base64Data: string,
    mimeType: string,
    prompt = 'Describe this video frame in detail. List key visible objects and actions. Return JSON: { "description": string, "objects": string[], "actions": string[] }'
  ): Promise<VisionFrameAnalysisResult | null> {
    const caps = this.getCapabilities();
    if (!caps.visionAvailable || !this.config.apiKey) {
      return null;
    }

    try {
      let rawText = '';
      if (this.config.provider === 'openai') {
        const res = await fetch(`${this.config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify({
            model: caps.model,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                ]
              }
            ]
          }),
          signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        rawText = json.choices?.[0]?.message?.content || '';
      } else if (this.config.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${caps.model}:generateContent?key=${this.config.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType, data: base64Data } }
                ]
              }
            ],
            generationConfig: { responseMimeType: 'application/json' }
          }),
          signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) return null;
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      if (!rawText) return null;
      const parsed = JSON.parse(rawText) as { description?: string; objects?: string[]; actions?: string[] };
      if (!parsed.description) return null;

      return {
        description: parsed.description,
        objects: Array.isArray(parsed.objects) ? parsed.objects : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        analyzedVisually: true
      };
    } catch {
      return null;
    }
  }

  public async transcribeAudioFile(filePath: string, mimeType: string): Promise<string | null> {
    const caps = this.getCapabilities();
    if (!caps.configured || !this.config.apiKey || !fs.existsSync(filePath)) {
      return null;
    }

    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.size === 0 || stat.size > 20 * 1024 * 1024) {
        return null;
      }

      if (this.config.provider === 'openai') {
        const buffer = await fs.promises.readFile(filePath);
        const form = new FormData();
        form.append('file', new Blob([buffer], { type: mimeType }), path.basename(filePath));
        form.append('model', 'whisper-1');

        const res = await fetch(`${this.config.baseUrl || 'https://api.openai.com/v1'}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`
          },
          body: form,
          signal: AbortSignal.timeout(30000)
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { text?: string };
        return json.text?.trim() || null;
      }

      if (this.config.provider === 'gemini') {
        const b64 = (await fs.promises.readFile(filePath)).toString('base64');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${caps.model}:generateContent?key=${this.config.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: 'Transcribe all spoken words verbatim. If there is no speech, return an empty string.' },
                  { inlineData: { mimeType, data: b64 } }
                ]
              }
            ]
          }),
          signal: AbortSignal.timeout(30000)
        });
        if (!res.ok) return null;
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
      }
    } catch {
      return null;
    }
    return null;
  }
}

