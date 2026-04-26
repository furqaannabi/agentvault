const nextConfig = {
  turbopack: {
    root: '.',
  },
  webpack: (config: { resolve: { alias: Record<string, boolean> } }) => {
    // Suppress MetaMask SDK's optional React Native dep
    config.resolve.alias['@react-native-async-storage/async-storage'] = false
    return config
  },
}

export default nextConfig
