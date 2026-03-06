import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID, normalizeStructTag } from '@mysten/sui/utils';
import { MAINNET, TESTNET, PRE_MARKET_MODULE, WEI6, DEFAULT_GAS_BUDGET } from '../constants';
import { checkAndSplitCoin, extractPhantomType } from '../utils';
import { TxResult, OfferData, OrderData, OfferStatus, OrderStatus } from '../../types';

type NetworkObjects = typeof MAINNET;

export class SuiPreMarket {
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private net: NetworkObjects;
  private gasBudget: number;

  constructor(rpcUrl: string, keypair: Ed25519Keypair, gasBudget = DEFAULT_GAS_BUDGET) {
    this.client = new SuiClient({ url: rpcUrl });
    this.keypair = keypair;
    this.net = rpcUrl.includes('testnet') ? TESTNET : MAINNET;
    this.gasBudget = gasBudget;
  }

  private get sender(): string {
    return this.keypair.getPublicKey().toSuiAddress();
  }

  private async executeTransaction(tx: Transaction): Promise<TxResult> {
    tx.setSender(this.sender);
    tx.setGasBudget(this.gasBudget);

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      options: { showEffects: true },
    });

    const digest = result.digest;
    return {
      txHash: digest,
      wait: async () => {
        await this.client.waitForTransaction({ digest });
      },
    };
  }

  async getOffer(offerId: string): Promise<OfferData> {
    const obj = await this.client.getObject({ id: offerId, options: { showContent: true } });
    const fields = (obj.data?.content as any)?.fields;
    if (!fields) throw new Error(`Offer ${offerId} not found`);

    const statusStr: string = fields.status ?? 'Open';
    let status = OfferStatus.Open;
    if (statusStr === 'Filled') status = OfferStatus.Filled;
    if (statusStr === 'Cancelled') status = OfferStatus.Cancelled;

    return {
      totalAmount: Number(BigInt(fields.amount) / WEI6),
      filledAmount: Number(BigInt(fields.filled_amount ?? 0) / WEI6),
      collateral: {
        amount: fields.value?.toString() ?? '0',
        uiAmount: (Number(BigInt(fields.value ?? 0)) / 1e9).toString(),
      },
      isFullMatch: fields.full_match ?? false,
      status,
    };
  }

  async getOrder(orderId: string): Promise<OrderData> {
    const obj = await this.client.getObject({ id: orderId, options: { showContent: true } });
    const fields = (obj.data?.content as any)?.fields;
    if (!fields) throw new Error(`Order ${orderId} not found`);

    const statusStr: string = fields.status ?? 'Open';
    let status = OrderStatus.Open;
    if (statusStr === 'SettleFilled') status = OrderStatus.SettleFilled;
    if (statusStr === 'SettleCancelled') status = OrderStatus.SettleCancelled;
    if (statusStr === 'Cancelled') status = OrderStatus.Cancelled;

    return {
      amount: Number(BigInt(fields.amount) / WEI6),
      buyer: fields.buyer,
      seller: fields.seller,
      offerId: fields.offer_id ?? '',
      status,
    };
  }

  async createOffer(params: {
    tokenConfig: string; // Sui object ID of the token config
    offerType: 'Buy' | 'Sell'; // 1 = Buy, 2 = Sell
    amount: bigint;      // token units (WEI6)
    value: bigint;       // collateral in coin raw units
    fullMatch: boolean;
    coinType: string;    // e.g. "0x2::sui::SUI"
  }): Promise<TxResult> {
    const coinType = normalizeStructTag(params.coinType);
    const tx = new Transaction();

    const coin = await checkAndSplitCoin(this.client, tx, this.sender, coinType, params.value);

    const offerTypeU8 = params.offerType === 'Buy' ? 1 : 2;

    tx.moveCall({
      target: `${this.net.packageId}::${PRE_MARKET_MODULE}::create_offer`,
      arguments: [
        tx.object(this.net.configId),
        tx.object(params.tokenConfig),
        coin,
        tx.pure.u8(offerTypeU8),
        tx.pure.u64(params.amount),
        tx.pure.u64(params.value),
        tx.pure.bool(params.fullMatch),
      ],
      typeArguments: [coinType],
    });

    return this.executeTransaction(tx);
  }

  async fillOffer(params: {
    offerId: string;
    amount: bigint; // token units (WEI6)
  }): Promise<TxResult> {
    const offerObj = await this.client.getObject({ id: params.offerId, options: { showContent: true } });
    const fields = (offerObj.data?.content as any)?.fields;
    if (!fields) throw new Error(`Offer ${params.offerId} not found`);

    const coinType = extractPhantomType((offerObj.data?.content as any)?.type);
    const tokenConfig: string = fields.token_id;

    const offerType: string = fields.offer_type;
    const offerValue = BigInt(fields.value);
    const offerAmount = BigInt(fields.amount);
    const offerCollateral = BigInt(fields.collateral ?? fields.value);

    const orderValue = (offerValue * params.amount) / offerAmount;
    const orderCollateral = (offerCollateral * params.amount) / offerAmount;
    const transferAmount = offerType === 'Buy' ? orderCollateral : orderValue;

    const tx = new Transaction();
    const coin = await checkAndSplitCoin(this.client, tx, this.sender, coinType, transferAmount);

    tx.moveCall({
      target: `${this.net.packageId}::${PRE_MARKET_MODULE}::fill_offer`,
      arguments: [
        tx.object(this.net.configId),
        tx.object(tokenConfig),
        tx.object(params.offerId),
        coin,
        tx.pure.u64(params.amount),
      ],
      typeArguments: [coinType],
    });

    return this.executeTransaction(tx);
  }

  async cancelOffer(offerId: string): Promise<TxResult> {
    const offerObj = await this.client.getObject({ id: offerId, options: { showContent: true } });
    const coinType = extractPhantomType((offerObj.data?.content as any)?.type);

    const tx = new Transaction();
    tx.moveCall({
      target: `${this.net.packageId}::${PRE_MARKET_MODULE}::cancel_offer`,
      arguments: [tx.object(this.net.configId), tx.object(offerId)],
      typeArguments: [coinType],
    });

    return this.executeTransaction(tx);
  }

  async settleOrder(orderId: string): Promise<TxResult> {
    const orderObj = await this.client.getObject({ id: orderId, options: { showContent: true } });
    const orderFields = (orderObj.data?.content as any)?.fields;
    const tokenConfigId: string = orderFields.token_id;

    const tokenConfigObj = await this.client.getObject({ id: tokenConfigId, options: { showContent: true } });
    const tokenConfigFields = (tokenConfigObj.data?.content as any)?.fields;

    const coinType = extractPhantomType((orderObj.data?.content as any)?.type);
    const tokenTypeName: string = tokenConfigFields?.token_type?.fields?.name;
    if (!tokenTypeName) throw new Error(`Token ${tokenConfigId} is not yet in settle phase`);
    const tokenType = normalizeStructTag(tokenTypeName);

    const orderAmount = BigInt(orderFields.amount);
    const settleRate = BigInt(tokenConfigFields.settle_rate);
    const amount = (orderAmount * settleRate) / WEI6;

    const tx = new Transaction();
    const coin = await checkAndSplitCoin(this.client, tx, this.sender, tokenType, amount);

    tx.moveCall({
      target: `${this.net.packageId}::${PRE_MARKET_MODULE}::settle_filled`,
      arguments: [
        tx.object(this.net.configId),
        tx.object(tokenConfigId),
        tx.object(orderId),
        coin,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      typeArguments: [coinType, tokenType],
    });

    return this.executeTransaction(tx);
  }

  async settleOrderWithDiscount(params: {
    orderId: string;
    sellerDiscount: number;
    buyerDiscount: number;
    signature: Uint8Array;
  }): Promise<TxResult> {
    const orderObj = await this.client.getObject({ id: params.orderId, options: { showContent: true } });
    const orderFields = (orderObj.data?.content as any)?.fields;
    const tokenConfigId: string = orderFields.token_id;

    const tokenConfigObj = await this.client.getObject({ id: tokenConfigId, options: { showContent: true } });
    const tokenConfigFields = (tokenConfigObj.data?.content as any)?.fields;

    const coinType = extractPhantomType((orderObj.data?.content as any)?.type);
    let tokenTypeName: string = tokenConfigFields?.token_type?.fields?.name;
    if (!tokenTypeName) throw new Error(`Token ${tokenConfigId} is not yet in settle phase`);
    if (!tokenTypeName.startsWith('0x')) tokenTypeName = `0x${tokenTypeName}`;
    const tokenType = normalizeStructTag(tokenTypeName);

    const orderAmount = BigInt(orderFields.amount);
    const settleRate = BigInt(tokenConfigFields.settle_rate);
    const amount = (orderAmount * settleRate) / WEI6;

    const tx = new Transaction();
    const coin = await checkAndSplitCoin(this.client, tx, this.sender, tokenType, amount);

    tx.moveCall({
      target: `${this.net.packageId}::${PRE_MARKET_MODULE}::settle_filled_with_discount`,
      arguments: [
        tx.object(this.net.configId),
        tx.object(tokenConfigId),
        tx.object(params.orderId),
        coin,
        tx.object(SUI_CLOCK_OBJECT_ID),
        tx.pure.u64(params.sellerDiscount),
        tx.pure.u64(params.buyerDiscount),
        tx.pure.vector('u8', params.signature),
      ],
      typeArguments: [coinType, tokenType],
    });

    return this.executeTransaction(tx);
  }

  async cancelOrder(orderId: string): Promise<TxResult> {
    const orderObj = await this.client.getObject({ id: orderId, options: { showContent: true } });
    const orderFields = (orderObj.data?.content as any)?.fields;
    const tokenConfigId: string = orderFields.token_id;
    const coinType = extractPhantomType((orderObj.data?.content as any)?.type);

    const tx = new Transaction();
    tx.moveCall({
      target: `${this.net.packageId}::${PRE_MARKET_MODULE}::settle_cancelled`,
      arguments: [
        tx.object(this.net.configId),
        tx.object(tokenConfigId),
        tx.object(orderId),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      typeArguments: [coinType],
    });

    return this.executeTransaction(tx);
  }
}
