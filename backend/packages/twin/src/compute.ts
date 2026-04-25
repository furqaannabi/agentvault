import OpenAI from 'openai';
import type { TwinConfig } from './config.js';

export interface ComputeClient {
  infer(systemPrompt: string, userPrompt: string): Promise<string>;
  cfg: TwinConfig;
}

export function makeComputeClient(cfg: TwinConfig): ComputeClient {
  const client = new OpenAI({
    apiKey: cfg.computeApiKey,
    baseURL: cfg.computeBaseUrl,
    timeout: 120_000, // 0G providers can be slow on cold start
    maxRetries: 1,
  });
  return {
    cfg,
    async infer(systemPrompt, userPrompt) {
      const res = await client.chat.completions.create({
        model: cfg.computeModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 400, // proposals are small JSON; cap to keep latency bounded
      });
      const text = res.choices[0]?.message?.content ?? '';
      if (!text) throw new Error('empty completion');
      return text;
    },
  };
}
