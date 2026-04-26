import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia } from 'wagmi/chains'
import { http } from 'wagmi'

const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL

export const wagmiConfig = getDefaultConfig({
  appName:   'AgentVault — ProofTwin',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'agentvault-dev',
  chains:    [sepolia],
  transports: {
    [sepolia.id]: rpcUrl ? http(rpcUrl) : http(),
  },
  ssr: true,
})

export { sepolia }
