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
      });
      const text = res.choices[0]?.message?.content ?? '';
      if (!text) throw new Error('empty completion');
      return text;
    },
  };
}
