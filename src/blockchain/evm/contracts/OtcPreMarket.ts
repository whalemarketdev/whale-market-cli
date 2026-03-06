import { ethers, HDNodeWallet, Contract } from 'ethers';
import axios from 'axios';
import { abiOTCPremarket } from './abis/OtcPreMarket';
import { abiOTCPremarketRef } from './abis/OtcPreMarketRef';
import { ERC20_ABI } from './abis/ERC20';
import { isReferralNetwork, ETH_ADDRESS, formatUnits, encodeOtcResellData } from '../utils';
import { TxResult, OtcOfferData, OfferStatus, OtcDiscountData } from '../../types';
import { EvmPreMarket } from './PreMarket';

export class EvmOtcPreMarket {
  private contract: Contract;
  private signer: HDNodeWallet;
  private provider: ethers.JsonRpcProvider;
  private chainId: number;
  private isReferral: boolean;
  private fundDistributor: string;
  private preMarketAddress: string;
  private apiUrl: string;

  constructor(
    rpcUrl: string,
    contractAddress: string,
    preMarketAddress: string,
    signer: HDNodeWallet,
    fundDistributor: string = ethers.ZeroAddress,
    apiUrl: string = 'https://api.whales.market'
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = signer.connect(this.provider);
    this.chainId = 0;
    this.isReferral = false;
    this.fundDistributor = fundDistributor;
    this.preMarketAddress = preMarketAddress;
    this.apiUrl = apiUrl;

    this.contract = new Contract(contractAddress, abiOTCPremarket, this.signer);
  }

  async init(): Promise<void> {
    if (this.chainId !== 0) return;
    const network = await this.provider.getNetwork();
    this.chainId = Number(network.chainId);
    this.isReferral = isReferralNetwork(this.chainId);

    const abi = this.isReferral ? abiOTCPremarketRef : abiOTCPremarket;
    this.contract = new Contract(this.contract.target as string, abi, this.signer);
  }

  private get address(): string {
    return this.contract.target as string;
  }

  private getFundDistributor(): string {
    if (this.fundDistributor === ethers.ZeroAddress || !this.fundDistributor) {
      throw new Error('Fund distributor address not configured');
    }
    return this.fundDistributor;
  }

  private async ensureApproval(tokenAddress: string, amount: bigint): Promise<void> {
    if (tokenAddress === ETH_ADDRESS) return;
    const token = new Contract(tokenAddress, ERC20_ABI, this.signer);
    const current: bigint = await token.allowance(this.signer.address, this.address);
    if (current < amount) {
      const tx = await token.approve(this.address, ethers.MaxUint256);
      await tx.wait();
    }
  }

  async getPosition(positionId: string, exTokenAddress: string): Promise<OtcOfferData> {
    const raw = await this.contract.otcOffers(positionId);
    const decimals =
      exTokenAddress === ETH_ADDRESS
        ? 18
        : Number(
            await new Contract(exTokenAddress, ERC20_ABI, this.provider).decimals()
          );

    const statusNum = Number(raw[6] ?? raw.status);
    const status =
      statusNum === 2 || statusNum === 3 ? OfferStatus.Cancelled : OfferStatus.Open;

    return {
      collateral: {
        amount: (raw[4] ?? raw.value).toString(),
        uiAmount: formatUnits(raw[4] ?? raw.value, decimals),
      },
      status,
      isBuyer: raw[1] ?? raw.isBuyer,
    };
  }

  async createOffer(params: {
    orderId: number;
    exTokenAddress: string;
    value: bigint;    // price in exToken raw units
    deadline: number; // unix timestamp
  }): Promise<TxResult> {
    await this.init();

    // Fetch pre-market order to confirm the caller is the buyer
    const preMarket = new EvmPreMarket(
      this.provider._getConnection().url,
      this.preMarketAddress,
      this.signer,
      this.fundDistributor,
      this.apiUrl
    );
    const order = await preMarket.getOrder(params.orderId);
    if (order.buyer.toLowerCase() !== this.signer.address.toLowerCase()) {
      throw new Error('Only the buyer of the pre-market order can create an OTC offer');
    }

    const signatureDeadline = Math.floor(Date.now() / 1000) + 3600;

    // Hash matching the contract's _getTransferOrderMessageHash function
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'address', 'bool', 'uint256', 'uint256', 'address'],
      [
        this.preMarketAddress,
        params.orderId,
        this.address,
        true, // isBuyer
        signatureDeadline,
        this.chainId,
        this.address,
      ]
    );

    const signature = await this.signer.signMessage(ethers.getBytes(messageHash));

    const tx = await this.contract.createOffer(
      {
        orderId: params.orderId,
        isBuyer: true,
        exToken: params.exTokenAddress,
        value: params.value,
        offerDeadline: params.deadline,
        signature,
      },
      signatureDeadline
    );

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }

  async fillOffer(offerId: string): Promise<TxResult> {
    await this.init();

    const offerRaw = await this.contract.otcOffers(offerId);
    const exToken: string = offerRaw[3] ?? offerRaw.exToken;
    const value: bigint = offerRaw[4] ?? offerRaw.value;

    await this.ensureApproval(exToken, value);

    let tx: ethers.ContractTransactionResponse;
    if (this.isReferral) {
      if (exToken === ETH_ADDRESS) {
        tx = await this.contract.fillOffer(offerId, '0x', this.getFundDistributor(), {
          value,
        });
      } else {
        tx = await this.contract.fillOffer(offerId, '0x', this.getFundDistributor());
      }
    } else {
      if (exToken === ETH_ADDRESS) {
        tx = await this.contract.fillOffer(offerId, { value });
      } else {
        tx = await this.contract.fillOffer(offerId);
      }
    }

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }

  async fillOfferWithDiscount(params: {
    offerId: string;
    offerUUID: string;
  }): Promise<TxResult> {
    await this.init();

    const offerRaw = await this.contract.otcOffers(params.offerId);
    const exToken: string = offerRaw[3] ?? offerRaw.exToken;
    const value: bigint = offerRaw[4] ?? offerRaw.value;

    await this.ensureApproval(exToken, value);

    const { data } = await axios.post(
      `${this.apiUrl}/transactions/build-txf-fill-resell-with-discount-evm`,
      { offerId: params.offerUUID, sender: this.signer.address }
    );
    const d: OtcDiscountData = data.data;

    const encoded = encodeOtcResellData(
      BigInt(params.offerId),
      d.buyerDiscount,
      d.buyerReferrer ?? ethers.ZeroAddress,
      d.buyerReferralPercent ?? 0,
      d.signature
    );

    let tx: ethers.ContractTransactionResponse;
    if (this.isReferral) {
      if (exToken === ETH_ADDRESS) {
        tx = await this.contract.fillOffer(params.offerId, encoded, this.getFundDistributor(), {
          value,
        });
      } else {
        tx = await this.contract.fillOffer(params.offerId, encoded, this.getFundDistributor());
      }
    } else {
      if (exToken === ETH_ADDRESS) {
        tx = await this.contract.fillOffer(params.offerId, { value });
      } else {
        tx = await this.contract.fillOffer(params.offerId);
      }
    }

    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }

  async cancelOffer(offerId: string): Promise<TxResult> {
    await this.init();
    const tx = await this.contract.cancelOffer(offerId);
    return { txHash: tx.hash, wait: () => tx.wait().then(() => undefined) };
  }
}
