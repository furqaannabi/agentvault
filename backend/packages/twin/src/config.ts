import type { Hex } from '@agentvault/types';

export interface TwinConfig {
  privateKey: Hex;
  computeBaseUrl: string;
  computeApiKey: string;
  computeModel: string;
  computeProviderAddr: Hex;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

export function twinConfigFromEnv(): TwinConfig {
  return {
    privateKey: req('ZG_PRIVATE_KEY') as Hex,
    computeBaseUrl: req('ZG_COMPUTE_BASE_URL'),
    computeApiKey: req('ZG_COMPUTE_API_KEY'),
    computeModel: req('ZG_COMPUTE_MODEL'),
    computeProviderAddr: req('ZG_COMPUTE_PROVIDER_ADDR') as Hex,
  };
}
