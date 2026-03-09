/**
 * Chain resolution and contract factory for multi-chain CLI commands.
 * Maps chainId to the correct blockchain adapter and contract instances.
 */

import { Connection } from '@solana/web3.js';
import { Network } from '@aptos-labs/ts-sdk';
import {
  EvmPreMarket,
  EvmOtcPreMarket,
  SolanaPreMarket,
  SolanaOtcPreMarket,
  SuiPreMarket,
  SuiOtcPreMarket,
  AptosPreMarket,
  AptosOtcPreMarket,
  EvmAdapter,
  SolanaAdapter,
  SuiAdapter,
  AptosAdapter,
  deriveEvmWallet,
  deriveSolanaKeypair,
  deriveSuiKeypair,
  deriveAptosAccount,
} from '../../blockchain';
import {
  EVM_CHAINS,
  PRE_MARKET_ADDRESS,
  OTC_PRE_MARKET_ADDRESS,
  FUND_DISTRIBUTOR_ADDRESS,
  getEvmRpcUrl,
} from '../../blockchain/evm/constants';
import { SOLANA_RPC, PRE_MARKET, OTC_PRE_MARKET } from '../../blockchain/solana/constants';
import { SUI_RPC, MAINNET as SUI_MAINNET } from '../../blockchain/sui/constants';
import { APTOS_RPC, MAINNET as APTOS_MAINNET } from '../../blockchain/aptos/constants';
import type { ChainAdapter } from '../../blockchain/types';
import { config } from '../../config';

// Chain ID constants (aligned with config and API)
export const SOLANA_MAINNET_CHAIN_ID = 666666;
export const SOLANA_DEVNET_CHAIN_ID = 999999;
export const SUI_MAINNET_CHAIN_ID = 900000;
export const SUI_TESTNET_CHAIN_ID = 900002;
export const APTOS_MAINNET_CHAIN_ID = 900001;
export const APTOS_TESTNET_CHAIN_ID = 900003;

export type ChainType = 'evm' | 'solana' | 'sui' | 'aptos';

export function getChainType(chainId: number): ChainType {
  if (chainId === SOLANA_MAINNET_CHAIN_ID || chainId === SOLANA_DEVNET_CHAIN_ID) {
    return 'solana';
  }
  if (chainId === SUI_MAINNET_CHAIN_ID || chainId === SUI_TESTNET_CHAIN_ID) {
    return 'sui';
  }
  if (chainId === APTOS_MAINNET_CHAIN_ID || chainId === APTOS_TESTNET_CHAIN_ID) {
    return 'aptos';
  }
  if (chainId in EVM_CHAINS) {
    return 'evm';
  }
  throw new Error(`Unsupported chain ID: ${chainId}. Use --chain-id to specify a supported chain.`);
}

export function isEvmChain(chainId: number): boolean {
  return getChainType(chainId) === 'evm';
}

export function isSolanaChain(chainId: number): boolean {
  return getChainType(chainId) === 'solana';
}

export function isSuiChain(chainId: number): boolean {
  return getChainType(chainId) === 'sui';
}

export function isAptosChain(chainId: number): boolean {
  return getChainType(chainId) === 'aptos';
}

/**
 * Resolve the RPC URL for a chain.
 * Priority: user custom RPC (config store) > default constant.
 */
export function resolveRpc(chainId: number): string {
  const custom = config.getCustomRpc(chainId);
  if (custom) return custom;

  if (chainId === SOLANA_DEVNET_CHAIN_ID) return SOLANA_RPC.DEVNET;
  if (chainId === SOLANA_MAINNET_CHAIN_ID) return SOLANA_RPC.MAINNET;
  if (chainId === SUI_TESTNET_CHAIN_ID) return SUI_RPC.TESTNET;
  if (chainId === SUI_MAINNET_CHAIN_ID) return SUI_RPC.MAINNET;
  if (chainId === APTOS_TESTNET_CHAIN_ID) return APTOS_RPC.TESTNET;
  if (chainId === APTOS_MAINNET_CHAIN_ID) return APTOS_RPC.MAINNET;
  return getEvmRpcUrl(chainId);
}

export function getChainAdapter(chainId: number): ChainAdapter {
  const type = getChainType(chainId);
  const rpcUrl = resolveRpc(chainId);

  if (type === 'evm') {
    if (!rpcUrl) throw new Error(`No RPC URL configured for chain ${chainId}`);
    return new EvmAdapter(rpcUrl);
  }

  if (type === 'solana') {
    return new SolanaAdapter(rpcUrl);
  }

  if (type === 'sui') {
    return new SuiAdapter(rpcUrl);
  }

  if (type === 'aptos') {
    const network =
      chainId === APTOS_TESTNET_CHAIN_ID ? Network.TESTNET : Network.MAINNET;
    return new AptosAdapter(network, rpcUrl);
  }

  throw new Error(`Chain adapter not implemented for chain ${chainId}`);
}

export type PreMarketInstance =
  | import('../../blockchain/evm/contracts/PreMarket').EvmPreMarket
  | import('../../blockchain/solana/programs/PreMarket').SolanaPreMarket
  | import('../../blockchain/sui/contracts/PreMarket').SuiPreMarket
  | import('../../blockchain/aptos/contracts/PreMarket').AptosPreMarket;

export type OtcPreMarketInstance =
  | import('../../blockchain/evm/contracts/OtcPreMarket').EvmOtcPreMarket
  | import('../../blockchain/solana/programs/OtcPreMarket').SolanaOtcPreMarket;

export function getPreMarket(
  chainId: number,
  mnemonic: string,
  apiUrl: string = 'https://api.whales.market'
): PreMarketInstance {
  const type = getChainType(chainId);
  const trimmed = mnemonic.trim();

  const rpcUrl = resolveRpc(chainId);

  if (type === 'evm') {
    const contractAddr = PRE_MARKET_ADDRESS[chainId];
    const fundDistributor = FUND_DISTRIBUTOR_ADDRESS[chainId] ?? '0x0000000000000000000000000000000000000000';
    if (!rpcUrl || !contractAddr) {
      throw new Error(`Pre-market not configured for chain ${chainId}`);
    }
    const signer = deriveEvmWallet(trimmed);
    return new EvmPreMarket(rpcUrl, contractAddr, signer, fundDistributor, apiUrl);
  }

  if (type === 'solana') {
    const connection = new Connection(rpcUrl, 'confirmed');
    const keypair = deriveSolanaKeypair(trimmed);
    const isMainnet = chainId === SOLANA_MAINNET_CHAIN_ID;
    return new SolanaPreMarket(connection, keypair, isMainnet);
  }

  if (type === 'sui') {
    const keypair = deriveSuiKeypair(trimmed);
    return new SuiPreMarket(rpcUrl, keypair);
  }

  if (type === 'aptos') {
    const account = deriveAptosAccount(trimmed);
    const network =
      chainId === APTOS_TESTNET_CHAIN_ID ? Network.TESTNET : Network.MAINNET;
    return new AptosPreMarket(account, network, rpcUrl);
  }

  throw new Error(`Pre-market not implemented for chain ${chainId}`);
}

export function getOtcPreMarket(
  chainId: number,
  mnemonic: string,
  apiUrl: string = 'https://api.whales.market'
): OtcPreMarketInstance {
  const type = getChainType(chainId);
  const trimmed = mnemonic.trim();

  const rpcUrl = resolveRpc(chainId);

  if (type === 'evm') {
    const contractAddr = OTC_PRE_MARKET_ADDRESS[chainId];
    const preMarketAddr = PRE_MARKET_ADDRESS[chainId];
    const fundDistributor = FUND_DISTRIBUTOR_ADDRESS[chainId] ?? '0x0000000000000000000000000000000000000000';
    if (!rpcUrl || !contractAddr || !preMarketAddr) {
      throw new Error(`OTC pre-market not configured for chain ${chainId}`);
    }
    const signer = deriveEvmWallet(trimmed);
    return new EvmOtcPreMarket(
      rpcUrl,
      contractAddr,
      preMarketAddr,
      signer,
      fundDistributor,
      apiUrl
    );
  }

  if (type === 'solana') {
    const connection = new Connection(rpcUrl, 'confirmed');
    const keypair = deriveSolanaKeypair(trimmed);
    const isMainnet = chainId === SOLANA_MAINNET_CHAIN_ID;
    return new SolanaOtcPreMarket(connection, keypair, isMainnet);
  }

  // Sui and Aptos OTC are stubs - throw with helpful message
  if (type === 'sui' || type === 'aptos') {
    throw new Error(
      `OTC pre-market is not yet implemented for ${type}. Use EVM or Solana (--chain-id 1, 8453, 666666, etc.).`
    );
  }

  throw new Error(`OTC pre-market not implemented for chain ${chainId}`);
}

/** Resolve offer/order ID format: EVM/Solana use numeric IDs, Sui/Aptos use string addresses. */
export function parseOfferId(chainId: number, value: string): number | string {
  const type = getChainType(chainId);
  if (type === 'evm' || type === 'solana') {
    const num = parseInt(value, 10);
    if (isNaN(num)) throw new Error(`Invalid offer ID for ${type}: ${value}`);
    return num;
  }
  return value;
}

/** Resolve order ID format. */
export function parseOrderId(chainId: number, value: string): number | string {
  return parseOfferId(chainId, value);
}
