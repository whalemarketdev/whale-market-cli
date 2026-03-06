// Shared types for multi-chain blockchain interaction

export type ChainName = 'evm' | 'solana' | 'sui' | 'aptos';

export enum OfferSide {
  Buy = 'buy',
  Sell = 'sell',
}

export enum OfferStatus {
  Open = 'open',
  Filled = 'filled',
  Cancelled = 'cancelled',
}

export enum OrderStatus {
  Open = 'open',
  SettleFilled = 'settle_filled',
  SettleCancelled = 'settle_cancelled',
  Cancelled = 'cancelled',
}

export interface TxResult {
  txHash: string;
  // Wait for on-chain confirmation
  wait(): Promise<void>;
}

export interface OfferData {
  totalAmount: number;    // token amount (6-decimal precision)
  filledAmount: number;
  collateral: {
    amount: string;       // raw on-chain value
    uiAmount: string;     // human-readable
  };
  isFullMatch: boolean;
  status: OfferStatus;
}

export interface OrderData {
  amount: number;         // token amount (6-decimal precision)
  buyer: string;
  seller: string;
  offerId: number | string;
  status: OrderStatus;
}

// Discount data returned by the backend API for settle/cancel operations
export interface DiscountData {
  orderId: string;
  sellerDiscount: number;
  buyerDiscount: number;
  signature: string;
  // Referral fields (present on referral-enabled networks)
  sellerReferrer?: string;
  buyerReferrer?: string;
  sellerReferralPercent?: number;
  buyerReferralPercent?: number;
}

// Discount data for OTC fill operations
export interface OtcDiscountData {
  offerId: string;
  buyerDiscount: number;
  signature: string;
  buyerReferrer?: string;
  buyerReferralPercent?: number;
}

export interface OtcOfferData {
  collateral: {
    amount: string;
    uiAmount: string;
  };
  status: OfferStatus;
  isBuyer: boolean;
}

export interface ChainAdapter {
  readonly chain: ChainName;
  getAddress(mnemonic: string): Promise<string>;
  getBalance(address: string, tokenAddress?: string): Promise<string>;
}
