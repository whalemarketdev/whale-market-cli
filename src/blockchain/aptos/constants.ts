// Fullnode URLs sourced from /ref/contracts-fe-integration/config/chains.config.ts
export const APTOS_RPC = {
  MAINNET: 'https://fullnode.mainnet.aptoslabs.com/v1',
  TESTNET: 'https://fullnode.testnet.aptoslabs.com/v1',
};

export const MAINNET = {
  packageId: '0x7152d921b7feb716313a8c45656098d551196d8c72b9c0f3b8e8348f75876e95',
};

export const TESTNET = {
  packageId: '0xc508d777a111925529664e104748462bee6659e70bce104fe134f0327d68d70c',
};

export const PRE_MARKET_MODULE = 'whales_pre_market';

// Amount precision: 1_000_000 = 1.0 tokens
export const WEI6 = 1_000_000;
