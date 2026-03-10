/**
 * Common ex-tokens (collateral) per chain for trade create-offer --ex-token.
 * Use for user/agent to choose. Source: whales-market-server currency_tokens.
 */
export interface ExToken {
  symbol: string;
  address: string;
  decimals: number;
  name?: string;
}

export const EX_TOKENS_BY_CHAIN: Record<number, ExToken[]> = {
  // BSC Testnet
  97: [
    { symbol: 'USDC', address: '0x4ae58bfc16b20bd67755ffd5560e85779d962415', decimals: 18, name: 'USDC' },
    { symbol: 'USDT', address: '0xc2bEFff2b148FB54B017b133a0764ef4E7A72dcA', decimals: 18, name: 'USDT' },
    { symbol: 'tUSDT', address: '0x821f1b5d8f12550822cc6132294599c6fc92b3d5', decimals: 18, name: 'tUSDT' },
    { symbol: 'USDT', address: '0xe41e2bd1f843b78663e71d1852623d735072a190', decimals: 18, name: 'USDT (alt)' },
  ],
  // BSC Mainnet
  56: [
    { symbol: 'USDC', address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', decimals: 18 },
    { symbol: 'USDT', address: '0x55d398326f99059ff775485246999027b3197955', decimals: 18 },
    { symbol: 'BUSD', address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', decimals: 18 },
  ],
  // Base Sepolia
  84532: [
    { symbol: 'USDC', address: '0x036cbd53842c5426634e7929541ec2318f3dcf7e', decimals: 6 },
  ],
  // Base Mainnet
  8453: [
    { symbol: 'USDC', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', decimals: 6 },
    { symbol: 'USDbC', address: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', decimals: 6 },
  ],
  // Ethereum
  1: [
    { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
    { symbol: 'USDT', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
  ],
  // Arbitrum
  42161: [
    { symbol: 'USDC', address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', decimals: 6 },
    { symbol: 'USDT', address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', decimals: 6 },
  ],
  // Base Mainnet
  10: [
    { symbol: 'USDC', address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', decimals: 6 },
    { symbol: 'USDT', address: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', decimals: 6 },
  ],
  // Linea
  59144: [
    { symbol: 'USDC', address: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff', decimals: 6 },
  ],
  // zkSync Era
  324: [
    { symbol: 'USDC', address: '0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4', decimals: 6 },
  ],
  // Monad Testnet
  10143: [
    { symbol: 'USDC', address: '0x4ae58bfc16b20bd67755ffd5560e85779d962415', decimals: 18 },
  ],
};

// Solana ex-tokens (mint addresses) - chain 666666 mainnet, 999999 devnet
export const SOLANA_EX_TOKENS: Record<number, ExToken[]> = {
  666666: [
    { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
    { symbol: 'USDT', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  ],
  999999: [
    { symbol: 'USDC', address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', decimals: 6 },
    { symbol: 'USDT', address: 'EJwZgeZrdC8TXTQbQBoL6bfFAnBJFWg6WbF25LYbQr3D', decimals: 6 },
  ],
};

// ETH sentinel for native token
export const ETH_SENTINEL = '0x0000000000000000000000000000000000000000';

export function getExTokensForChain(chainId: number): ExToken[] {
  const evm = EX_TOKENS_BY_CHAIN[chainId];
  if (evm) return evm;
  const sol = SOLANA_EX_TOKENS[chainId];
  if (sol) return sol;
  return [];
}

export function formatExTokensForDisplay(chainId: number): string {
  const tokens = getExTokensForChain(chainId);
  if (tokens.length === 0) return '-';
  return tokens.map((t) => `${t.symbol}: ${t.address}`).join('\n           ');
}
