// Solana program IDs, config accounts, and RPC endpoints.
// RPC URLs sourced from /ref/contracts-fe-integration/config/chains.config.ts

export const SOLANA_RPC = {
  MAINNET: 'https://api.mainnet-beta.solana.com',
  DEVNET: 'https://api.devnet.solana.com',
};

export const PRE_MARKET = {
  MAINNET: {
    PROGRAM_ID: 'stPdYNaJNsV3ytS9Xtx4GXXXRcVqVS6x66ZFa26K39S',
    CONFIG_ACCOUNT: 'GDsMbTq82sYcxPRLdQ9RHL9ZLY3HNVpXjXtCnyxpb2rQ',
    FEE_WALLET: '8FzAESKaw5yFZjDNNX7SU98gTEKZF6n57W94ehw38KRN',
  },
  DEVNET: {
    PROGRAM_ID: 'F8iCXCQDmUSNVB8zD7WmkDumKTqxWaMfMSXtNmRUtw4q',
    CONFIG_ACCOUNT: '7e3Frd6t4adXx3RXPyqh28ZuBBSdzkSmuFJCphsfF773',
    FEE_WALLET: '',
  },
};

export const OTC_PRE_MARKET = {
  MAINNET: {
    PROGRAM_ID: '5BA233jRRKAZsY765p72CXGZn5F5DMxtnP2ShhbJ2UBp',
    CONFIG_INDEX: 1,
  },
  DEVNET: {
    PROGRAM_ID: 'G36EWnoEPDWy62Lz9cYdi7R7LvQngsbgrZSmZKkLtAa9',
    CONFIG_INDEX: 1,
  },
};

// Amount precision: 1_000_000 = 1.0 tokens
export const WEI6 = 1_000_000;
