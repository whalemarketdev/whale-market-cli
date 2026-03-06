import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  InputGenerateTransactionData,
} from '@aptos-labs/ts-sdk';
import { MAINNET, TESTNET, PRE_MARKET_MODULE, WEI6 } from '../constants';
import { checkCoinToFa } from '../utils';
import { TxResult, OfferData, OrderData, OfferStatus, OrderStatus } from '../../types';

// Offer type constants matching the Move contract
const OFFER_TYPE_BUY = 1;
const OFFER_TYPE_SELL = 2;

// Order status constants from the Move contract
const STATUS_OPEN = 1;
const STATUS_SETTLE_FILLED = 2;
const STATUS_SETTLE_CANCELLED = 3;
const STATUS_CANCELLED = 4;

export class AptosPreMarket {
  private aptos: Aptos;
  private account: Account;
  private packageId: string;

  constructor(
    account: Account,
    network: Network = Network.MAINNET,
    fullnode?: string
  ) {
    const config = new AptosConfig({
      network,
      fullnode,
    });
    this.aptos = new Aptos(config);
    this.account = account;
    this.packageId = network === Network.MAINNET ? MAINNET.packageId : TESTNET.packageId;
  }

  private get sender(): string {
    return this.account.accountAddress.toString();
  }

  private async executeTransaction(txData: InputGenerateTransactionData): Promise<TxResult> {
    const rawTx = await this.aptos.transaction.build.simple(txData);
    const auth = await this.aptos.transaction.sign({ signer: this.account, transaction: rawTx });
    const submitted = await this.aptos.transaction.submit.simple({
      transaction: rawTx,
      senderAuthenticator: auth,
    });

    const txHash = submitted.hash;
    return {
      txHash,
      wait: async () => {
        await this.aptos.waitForTransaction({ transactionHash: txHash });
      },
    };
  }

  async getOffer(offerAddress: string): Promise<OfferData> {
    const res = await this.aptos.view({
      payload: {
        function: `${this.packageId}::${PRE_MARKET_MODULE}::get_offer`,
        functionArguments: [offerAddress],
      },
    }) as any[];

    const statusNum = Number(res[4]);
    let status = OfferStatus.Open;
    if (statusNum === STATUS_SETTLE_CANCELLED || statusNum === STATUS_CANCELLED) {
      status = OfferStatus.Cancelled;
    }

    const exTokenDecimals = 6; // most stablecoins; adjust per token if needed
    return {
      totalAmount: Number(res[5]) / WEI6,
      filledAmount: Number(res[7]) / WEI6,
      collateral: {
        amount: res[8].toString(),
        uiAmount: (Number(res[8]) / Math.pow(10, exTokenDecimals)).toString(),
      },
      isFullMatch: Boolean(res[9]),
      status,
    };
  }

  async getOrder(orderAddress: string): Promise<OrderData> {
    const res = await this.aptos.view({
      payload: {
        function: `${this.packageId}::${PRE_MARKET_MODULE}::get_order`,
        functionArguments: [orderAddress],
      },
    }) as any[];

    const statusNum = Number(res[4]);
    const statusMap: Record<number, OrderStatus> = {
      [STATUS_OPEN]: OrderStatus.Open,
      [STATUS_SETTLE_FILLED]: OrderStatus.SettleFilled,
      [STATUS_SETTLE_CANCELLED]: OrderStatus.SettleCancelled,
      [STATUS_CANCELLED]: OrderStatus.Cancelled,
    };

    return {
      amount: Number(res[5]) / WEI6,
      buyer: res[8]?.toString() ?? '',
      seller: res[9]?.toString() ?? '',
      offerId: res[1]?.toString() ?? '',
      status: statusMap[statusNum] ?? OrderStatus.Open,
    };
  }

  async createOffer(params: {
    tokenConfig: string;  // resource account address for the token config
    exToken: string;      // FA address or Coin type of the exchange token
    side: 'buy' | 'sell';
    amount: number;       // token units (human-readable, WEI6 precision)
    value: number;        // collateral in exToken raw units
    isFullMatch: boolean;
  }): Promise<TxResult> {
    const { useCoin, coinType } = await checkCoinToFa(this.aptos, this.sender, params.exToken);
    const offerType = params.side === 'buy' ? OFFER_TYPE_BUY : OFFER_TYPE_SELL;
    const rawAmount = Math.round(params.amount * WEI6).toString();
    const rawValue = params.value.toString();

    let txData: InputGenerateTransactionData;
    if (useCoin) {
      txData = {
        sender: this.sender,
        data: {
          function: `${this.packageId}::${PRE_MARKET_MODULE}::create_offer_with_coin`,
          functionArguments: [
            params.tokenConfig,
            params.exToken,
            offerType,
            rawAmount,
            rawValue,
            params.isFullMatch,
          ],
          typeArguments: [coinType],
        },
      };
    } else {
      txData = {
        sender: this.sender,
        data: {
          function: `${this.packageId}::${PRE_MARKET_MODULE}::create_offer`,
          functionArguments: [
            params.tokenConfig,
            params.exToken,
            offerType,
            rawAmount,
            rawValue,
            params.isFullMatch,
          ],
        },
      };
    }

    return this.executeTransaction(txData);
  }

  async fillOffer(params: {
    offerAddress: string;
    amount: number; // token units (human-readable)
  }): Promise<TxResult> {
    const offerData = await this.getOffer(params.offerAddress);

    const res = await this.aptos.view({
      payload: {
        function: `${this.packageId}::${PRE_MARKET_MODULE}::get_offer`,
        functionArguments: [params.offerAddress],
      },
    }) as any[];
    const exToken: string = res[1];

    const { useCoin, coinType } = await checkCoinToFa(this.aptos, this.sender, exToken);
    const rawAmount = Math.round(params.amount * WEI6).toString();

    let txData: InputGenerateTransactionData;
    if (useCoin) {
      txData = {
        sender: this.sender,
        data: {
          function: `${this.packageId}::${PRE_MARKET_MODULE}::fill_offer_with_coin`,
          functionArguments: [params.offerAddress, rawAmount],
          typeArguments: [coinType],
        },
      };
    } else {
      txData = {
        sender: this.sender,
        data: {
          function: `${this.packageId}::${PRE_MARKET_MODULE}::fill_offer`,
          functionArguments: [params.offerAddress, rawAmount],
        },
      };
    }

    return this.executeTransaction(txData);
  }

  async closeOffer(offerAddress: string): Promise<TxResult> {
    const txData: InputGenerateTransactionData = {
      sender: this.sender,
      data: {
        function: `${this.packageId}::${PRE_MARKET_MODULE}::cancel_offer`,
        functionArguments: [offerAddress],
      },
    };
    return this.executeTransaction(txData);
  }

  async settleOrder(orderAddress: string): Promise<TxResult> {
    const txData: InputGenerateTransactionData = {
      sender: this.sender,
      data: {
        function: `${this.packageId}::${PRE_MARKET_MODULE}::settle_filled`,
        functionArguments: [orderAddress],
      },
    };
    return this.executeTransaction(txData);
  }

  async settleOrderWithDiscount(params: {
    orderAddress: string;
    sellerDiscount: number;
    buyerDiscount: number;
    signature: string;
  }): Promise<TxResult> {
    const txData: InputGenerateTransactionData = {
      sender: this.sender,
      data: {
        function: `${this.packageId}::${PRE_MARKET_MODULE}::settle_filled_with_discount`,
        functionArguments: [
          params.orderAddress,
          params.buyerDiscount.toString(),
          params.sellerDiscount.toString(),
          params.signature,
        ],
      },
    };
    return this.executeTransaction(txData);
  }

  async cancelOrder(orderAddress: string): Promise<TxResult> {
    const txData: InputGenerateTransactionData = {
      sender: this.sender,
      data: {
        function: `${this.packageId}::${PRE_MARKET_MODULE}::settle_cancelled`,
        functionArguments: [orderAddress],
      },
    };
    return this.executeTransaction(txData);
  }

  async cancelOrderWithDiscount(params: {
    orderAddress: string;
    sellerDiscount: number;
    buyerDiscount: number;
    signature: string;
  }): Promise<TxResult> {
    const txData: InputGenerateTransactionData = {
      sender: this.sender,
      data: {
        function: `${this.packageId}::${PRE_MARKET_MODULE}::settle_cancelled_with_discount`,
        functionArguments: [
          params.orderAddress,
          params.buyerDiscount.toString(),
          params.sellerDiscount.toString(),
          params.signature,
        ],
      },
    };
    return this.executeTransaction(txData);
  }
}
