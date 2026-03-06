// RPC URLs sourced from /ref/contracts-fe-integration/config/chains.config.ts
export const SUI_RPC = {
  MAINNET: 'https://fullnode.mainnet.sui.io',
  TESTNET: 'https://fullnode.testnet.sui.io',
};

export const MAINNET = {
  packageId: '0x5aa83bf5554d30ae9da3767b451494389aa7e53ff086f25de15219f8edd334d9',
  eventPackageId: '0x5aa83bf5554d30ae9da3767b451494389aa7e53ff086f25de15219f8edd334d9',
  configId: '0x432656a3811b0020047f71eb64a0c713f879dcc6e257939077da55fdff254cf8',
  ownerCap: '0x8a2dcfcf1d9fd37b4a47373bbaaae1dad0392ec38a7836fab3ddffdbb5ee1151',
};

export const TESTNET = {
  packageId: '0xa4feb15226059567c82e0aa105787ca9e13f4fb7bc991f554e434482ce273f9e',
  eventPackageId: '0xde7efc0f5b6d899a6edcd7be5fc2b9062b420d8741876e93db0d5db15c0dfb3d',
  configId: '0x959266a1a3206fadf42852530fbf041a02e311bb932ff6798ee122f6e5429bf7',
  ownerCap: '0x73934c63e98c67a223805178f4afa879f278f84f2b315273e4e682760b0130f0',
};

export const PRE_MARKET_MODULE = 'whales_premarket';

// Amount precision: 1_000_000 = 1.0 tokens
export const WEI6 = 1_000_000n;

export const DEFAULT_GAS_BUDGET = 5_000_000;
