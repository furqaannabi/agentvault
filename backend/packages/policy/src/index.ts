import type { Twin } from '@agentvault/twin';
import type {
  Hex,
  PolicyVerdict,
  RuleResult,
  TradeProposal,
} from '@agentvault/types';
import { ethers } from 'ethers';
import { DEFAULT_POLICY, policySignerKey } from './config.js';
import { cooldown, dailyCap, maxSize, slippageCap, whitelist } from './rules/index.js';
import { buildVerdict, signVerdict } from './sign.js';
import type { PolicyContext, PolicyDefaults } from './types.js';

export type { PolicyContext, PolicyDefaults } from './types.js';
export { verdictDigest } from './sign.js';
export { DEFAULT_POLICY } from './config.js';

export interface Policy {
  check(proposal: TradeProposal, ctx: PolicyContext): Promise<PolicyVerdict>;
  defaults: PolicyDefaults;
  signerAddress(): Promise<Hex>;
}

export interface PolicyDeps {
  twin: Twin;
  signerKey?: Hex;
  defaults?: PolicyDefaults;
}

const RULES = [maxSize, slippageCap, whitelist, dailyCap, cooldown] as const;

export function createPolicy(deps: PolicyDeps): Policy {
  const signer = new ethers.Wallet(deps.signerKey ?? policySignerKey());
  const defaults = deps.defaults ?? DEFAULT_POLICY;
  return {
    defaults,
    async signerAddress() {
      return (await signer.getAddress()) as Hex;
    },
    async check(proposal, ctx) {
      const ruleResults: RuleResult[] = RULES.map((fn) => fn(proposal, ctx));
      const allDeterministicPass = ruleResults.every((r) => r.pass);

      // Subjective sanity check via twin's second LLM call (verifiable inference)
      const sanity = await deps.twin.sanityCheck(proposal);
      const ok = allDeterministicPass && sanity.result.ok;

      const ts = Date.now();
      const fields = {
        proposalId: proposal.id,
        ok,
        rules: ruleResults,
        sanityInference: sanity.inference,
        ts,
      };
      const signed = await signVerdict(signer, fields);
      return buildVerdict(fields, signed);
    },
  };
}
