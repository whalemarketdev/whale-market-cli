import { ethers } from 'ethers';

// Chain IDs where the pre-market contract uses the referral-enabled ABI variant.
// These chains have an extra `data` + `fundDistributor` parameter on settle/cancel/fill.
export const REFERRAL_CHAIN_IDS = new Set([
  // testnets
  421613,  // Arbitrum Goerli
  97,      // BSC Testnet
  84532,   // Base Sepolia
  11155111, // Sepolia
  420,     // Optimism Testnet
  // mainnets
  8453,    // Base
  169,     // Manta
  42161,   // Arbitrum
  4200,    // Merlin
  56,      // BSC
  59144,   // Linea
  999,     // HyperEVM
  146,     // Sonic
  1,       // Ethereum mainnet
]);

export function isReferralNetwork(chainId: number): boolean {
  return REFERRAL_CHAIN_IDS.has(chainId);
}

// Native ETH sentinel address used in pre-market contracts
export const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

export function parseUnits(value: number | string, decimals: number): bigint {
  return ethers.parseUnits(value.toString(), decimals);
}

export function formatUnits(value: bigint | string, decimals: number): string {
  return ethers.formatUnits(value.toString(), decimals);
}

// Encode settle/cancel discount data for referral-enabled networks.
// Produces the `bytes` argument expected by settleFilled / settleCancelled on those chains.
export function encodeSettleData(
  orderId: bigint | number,
  sellerDiscount: bigint | number,
  buyerDiscount: bigint | number,
  sellerReferrer: string,
  buyerReferrer: string,
  sellerReferralPercent: bigint | number,
  buyerReferralPercent: bigint | number,
  signature: string
): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const rawData = abiCoder.encode(
    ['tuple(uint256,uint256,uint256)', 'tuple(uint256,address,address,uint256,uint256)'],
    [
      [orderId, sellerDiscount, buyerDiscount],
      [orderId, sellerReferrer, buyerReferrer, sellerReferralPercent, buyerReferralPercent],
    ]
  );
  return abiCoder.encode(['bytes', 'bytes'], [rawData, signature]);
}

// Encode OTC fill discount data for referral-enabled networks.
export function encodeOtcResellData(
  offerId: bigint | number,
  buyerDiscount: bigint | number,
  buyerReferrer: string,
  buyerReferralPercent: bigint | number,
  signature: string
): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const rawData = abiCoder.encode(
    ['tuple(uint256,uint256,uint256)', 'tuple(uint256,address,address,uint256,uint256)'],
    [
      [offerId, 0, buyerDiscount],
      [offerId, ethers.ZeroAddress, buyerReferrer, 0, buyerReferralPercent],
    ]
  );
  return abiCoder.encode(['bytes', 'bytes'], [rawData, signature]);
}
