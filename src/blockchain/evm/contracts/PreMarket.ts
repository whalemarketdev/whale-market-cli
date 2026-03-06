import { ethers, HDNodeWallet, Contract } from 'ethers';
import axios from 'axios';
import { abiPreMarket } from './abis/PreMarket';
import { abiPreMarketRef } from './abis/PreMarketRef';
import { ERC20_ABI } from './abis/ERC20';
import {
  isReferralNetwork,
  ETH_ADDRESS,
  parseUnits,
  formatUnits,
  encodeSettleData,
} from '../utils';
import { TxResult, OfferData, OrderData, OfferStatus, OrderStatus, DiscountData } from '../../types';

// Token amount precision used by the pre-market contract (6 decimals)
const TOKEN_DECIMALS = 6;

export class EvmPreMarket {
  private contract: Contract;
  private signer: HDNodeWallet;
  private provider: ethers.JsonRpcProvider;
  private chainId: number;
  private isReferral: boolean;
  private fundDistributor: string;
  private apiUrl: string;

  constructor(
    rpcUrl: string,
    contractAddress: string,
    signer: HDNodeWallet,
    fundDistributor: string = ethers.ZeroAddress,
    apiUrl: string = 'https://api.whales.market'
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = signer.connect(this.provider);
    this.chainId = 0; // resolved lazily via init()
    this.isReferral = false;
    this.fundDistributor = fundDistributor;
    this.apiUrl = apiUrl;

    // Placeholder — real contract created after chainId is known (call init())
    this.contract = new Contract(contractAddress, abiPreMarket, this.signer);
  }

  /** Must be called once before any write operation to resolve chainId and select correct ABI. */
  async init(): Promise<void> {
    if (this.chainId !== 0) return;
    const network = await this.provider.getNetwork();
    this.chainId = Number(network.chainId);
    this.isReferral = isReferralNetwork(this.chainId);

    const abi = this.isReferral ? abiPreMarketRef : abiPreMarket;
    this.contract = new Contract(this.contract.target as string, abi, this.signer);
  }

  private get address(): string {
    return this.contract.target as string;
  }

  private getFundDistributor(): string {
    if (
      this.fundDistributor === ethers.ZeroAddress ||
      !this.fundDistributor
    ) {
      throw new Error('Fund distributor address not configured');
    }
    return this.fundDistributor;
  }

  private async getTokenDecimals(tokenAddress: string): Promise<number> {
    if (tokenAddress === ETH_ADDRESS) return 18;
    const token = new Contract(tokenAddress, ERC20_ABI, this.provider);
    return Number(await token.decimals());
  }

  private async ensureApproval(tokenAddress: string, amount: bigint): Promise<void> {
    if (tokenAddress === ETH_ADDRESS) return;
    const token = new Contract(tokenAddress, ERC20_ABI, this.signer);
    const current: bigint = await token.allowance(this.signer.address, this.address);
    if (current < amount) {
      // USDT (0xdAC1...) requires a zero-approval first to change allowance
      const lower = tokenAddress.toLowerCase();
      if (
        lower === '0xdac17f958d2ee523a2206206994597c13d831ec7'
      ) {
        const tx0 = await token.approve(this.address, 0n);
        await tx0.wait();
      }
      const tx = await token.approve(this.address, ethers.MaxUint256);
      await tx.wait();
    }
  }

  async getOffer(offerId: number): Promise<OfferData> {
    const raw = await this.contract.offers(offerId);
    const exTokenAddress: string = raw.exToken ?? raw[5] ?? ETH_ADDRESS;
    const decimals = await this.getTokenDecimals(exTokenAddress);

    let status = OfferStatus.Open;
    const statusNum = Number(raw.status ?? raw[6]);
    if (statusNum === 2 || statusNum === 3) status = OfferStatus.Cancelled;

    return {
      totalAmount: Number(formatUnits(raw.amount ?? raw[2], TOKEN_DECIMALS)),
      filledAmount: Number(formatUnits(raw.filledAmount ?? raw[3], TOKEN_DECIMALS)),
      collateral: {
        amount: (raw.collateral ?? raw[4]).toString(),
        uiAmount: formatUnits(raw.collateral ?? raw[4], decimals),
      },
      isFullMatch: raw.fullMatch ?? raw[1],
      status,
    };
  }

  async getOrder(orderId: number): Promise<OrderData> {
    const raw = await this.contract.orders(orderId);
    const statusMap: Record<number, OrderStatus> = {
      1: OrderStatus.Open,
      2: OrderStatus.SettleFilled,
      3: OrderStatus.SettleCancelled,
    };
    return {
      amount: Number(formatUnits(raw.amount ?? raw[0], TOKEN_DECIMALS)),
      buyer: raw.buyer ?? raw[1],
      seller: raw.seller ?? raw[2],
      offerId: Number(raw.offerId ?? raw[3]),
      status: statusMap[Number(raw.status ?? raw[4])] ?? OrderStatus.Open,
    };
  }

  async createOffer(params: {
    tokenId: number | string;  // number for legacy, bytes32 hex string (e.g. 0x31363831...) for EVM
    side: 'buy' | 'sell';
    amount: number;      // token amount (human-readable, 6-decimal precision)
    collateral: bigint;  // pre-computed collateral amount in exToken raw units
    exTokenAddress: string;
    isFullMatch: boolean;
  }): Promise<TxResult> {
    await this.init();
    await this.ensureApproval(params.exTokenAddress, params.collateral);

    const offerType = params.side === 'buy' ? 1 : 2;
    const rawAmount = parseUnits(params.amount, TOKEN_DECIMALS);

    // Contract expects bytes32 for tokenId - ensure proper format
    const tokenIdBytes32 =
      typeof params.tokenId === 'string' && params.tokenId.startsWith('0x')
        ? params.tokenId
        : ethers.zeroPadValue(ethers.toBeHex(params.tokenId, 32), 32);

    let tx: ethers.ContractTransactionResponse;

    if (params.exTokenAddress === ETH_ADDRESS) {
      tx = await this.contract.newOfferETH(
        offerType,
        tokenIdBytes32,
        rawAmount,
        params.collateral,
        params.isFullMatch,
        { value: params.collateral }
      );
    } else {
      tx = await this.contract.newOffer(
        offerType,
        tokenIdBytes32,
        rawAmount,
        params.collateral,
        params.exTokenAddress,
        params.isFullMatch
      );
    }

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }

  async fillOffer(params: {
    offerId: number;
    amount: number;      // token amount
    collateral: bigint;  // collateral to lock (raw units)
    exTokenAddress: string;
  }): Promise<TxResult> {
    await this.init();
    await this.ensureApproval(params.exTokenAddress, params.collateral);

    const rawAmount = parseUnits(params.amount, TOKEN_DECIMALS);
    let tx: ethers.ContractTransactionResponse;

    if (params.exTokenAddress === ETH_ADDRESS) {
      tx = await this.contract.fillOfferETH(params.offerId, rawAmount, {
        value: params.collateral,
      });
    } else {
      tx = await this.contract.fillOffer(params.offerId, rawAmount);
    }

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }

  async closeOffer(offerId: number): Promise<TxResult> {
    await this.init();
    let tx: ethers.ContractTransactionResponse;

    if (this.isReferral) {
      tx = await this.contract.cancelOffer(offerId, '0x', this.getFundDistributor());
    } else {
      tx = await this.contract.cancelOffer(offerId);
    }

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }

  async settleOrder(params: {
    orderId: number;
    tokenAddress: string;
    amount: bigint;     // settlement token amount (raw units)
  }): Promise<TxResult> {
    await this.init();
    await this.ensureApproval(params.tokenAddress, params.amount);

    let tx: ethers.ContractTransactionResponse;
    if (this.isReferral) {
      tx = await this.contract.settleFilled(params.orderId, '0x', this.getFundDistributor());
    } else {
      tx = await this.contract.settleFilled(params.orderId);
    }

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }

  async settleOrderWithDiscount(params: {
    orderId: number;
    orderUUID: string;
    tokenAddress: string;
    amount: bigint;
  }): Promise<TxResult> {
    await this.init();
    await this.ensureApproval(params.tokenAddress, params.amount);

    const endpoint = this.isReferral
      ? `${this.apiUrl}/transactions/v2/build-transaction-settle-with-discount-evm`
      : `${this.apiUrl}/transactions/build-transaction-settle-with-discount-evm`;

    const payload = this.isReferral
      ? { orderId: params.orderUUID, sender: this.signer.address }
      : { orderId: params.orderUUID };

    const { data } = await axios.post(endpoint, payload);
    const d: DiscountData = data.data;

    let tx: ethers.ContractTransactionResponse;
    if (this.isReferral) {
      tx = await this.contract.settleFilled(
        params.orderId,
        encodeSettleData(
          params.orderId,
          d.sellerDiscount,
          d.buyerDiscount,
          d.sellerReferrer ?? ethers.ZeroAddress,
          d.buyerReferrer ?? ethers.ZeroAddress,
          d.sellerReferralPercent ?? 0,
          d.buyerReferralPercent ?? 0,
          d.signature
        ),
        this.getFundDistributor()
      );
    } else {
      tx = await this.contract.settleFilledWithDiscount(params.orderId, {
        orderId: params.orderId,
        sellerDiscount: d.sellerDiscount,
        buyerDiscount: d.buyerDiscount,
        signature: d.signature,
      });
    }

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }

  async cancelOrder(orderId: number): Promise<TxResult> {
    await this.init();
    let tx: ethers.ContractTransactionResponse;

    if (this.isReferral) {
      tx = await this.contract.settleCancelled(orderId, '0x', this.getFundDistributor());
    } else {
      tx = await this.contract.settleCancelled(orderId);
    }

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }

  async cancelOrderWithDiscount(params: {
    orderId: number;
    orderUUID: string;
  }): Promise<TxResult> {
    await this.init();

    const endpoint = this.isReferral
      ? `${this.apiUrl}/transactions/v2/build-transaction-cancel-with-discount-evm`
      : `${this.apiUrl}/transactions/build-transaction-cancel-with-discount-evm`;

    const payload = this.isReferral
      ? { orderId: params.orderUUID, sender: this.signer.address }
      : { orderId: params.orderUUID };

    const { data } = await axios.post(endpoint, payload);
    const d: DiscountData = data.data;

    let tx: ethers.ContractTransactionResponse;
    if (this.isReferral) {
      tx = await this.contract.settleCancelled(
        params.orderId,
        encodeSettleData(
          params.orderId,
          d.sellerDiscount,
          d.buyerDiscount,
          d.sellerReferrer ?? ethers.ZeroAddress,
          d.buyerReferrer ?? ethers.ZeroAddress,
          d.sellerReferralPercent ?? 0,
          d.buyerReferralPercent ?? 0,
          d.signature
        ),
        this.getFundDistributor()
      );
    } else {
      tx = await this.contract.settleCancelledWithDiscount(params.orderId, {
        orderId: params.orderId,
        sellerDiscount: d.sellerDiscount,
        buyerDiscount: d.buyerDiscount,
        signature: d.signature,
      });
    }

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }
}
