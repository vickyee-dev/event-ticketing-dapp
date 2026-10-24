// Chains the app knows how to talk to and how to add to a wallet.
export const CHAINS = {
  43113: {
    id: 43113,
    name: "Avalanche Fuji",
    hexId: "0xa869",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    explorer: "https://testnet.snowtrace.io",
    faucet: "https://core.app/tools/testnet-faucet/?subnet=c&token=c",
    currency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    testnet: true,
  },
  43114: {
    id: 43114,
    name: "Avalanche C-Chain",
    hexId: "0xa86a",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorer: "https://snowtrace.io",
    faucet: null,
    currency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    testnet: false,
  },
  31337: {
    id: 31337,
    name: "Local Hardhat",
    hexId: "0x7a69",
    rpcUrl: "http://127.0.0.1:8545",
    explorer: null,
    faucet: null,
    currency: { name: "Ether", symbol: "ETH", decimals: 18 },
    testnet: true,
  },
};
