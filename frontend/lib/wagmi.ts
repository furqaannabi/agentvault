import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName:   'AgentVault — ProofTwin',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'agentvault-dev',
  chains:    [baseSepolia],
  ssr:       true,
})

export { baseSepolia }
