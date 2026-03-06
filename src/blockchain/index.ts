// Unified entry point for all chain adapters and contract wrappers

export * from './types';

// EVM
export { EvmAdapter, EvmPreMarket, EvmOtcPreMarket } from './evm/index';
export { deriveEvmWallet, deriveEvmAddress } from './evm/signer';

// Solana
export { SolanaAdapter, SolanaPreMarket, SolanaOtcPreMarket } from './solana/index';
export { deriveSolanaKeypair, deriveSolanaAddress } from './solana/signer';

// Sui
export { SuiAdapter, SuiPreMarket, SuiOtcPreMarket, deriveSuiKeypair, deriveSuiAddress } from './sui/index';

// Aptos
export { AptosAdapter, AptosPreMarket, AptosOtcPreMarket, deriveAptosAddress } from './aptos/index';
export { deriveAptosAccount } from './aptos/signer';
