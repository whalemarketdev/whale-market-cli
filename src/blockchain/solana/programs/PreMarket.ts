import * as anchor from '@coral-xyz/anchor';
import { BN, Program } from '@coral-xyz/anchor';
import {
  Connection,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  NATIVE_MINT,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import axios from 'axios';
import { IDL, PreMarketType } from './idl/pre_market';
import { PRE_MARKET, WEI6 } from '../constants';
import { TxResult, OfferData, OrderData, OfferStatus, OrderStatus } from '../../types';
import { buildWrapSolInstructions } from '../utils';

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 1500;

// ── PDA helpers ────────────────────────────────────────────────────────────────

function getSeed(name: string, program: Program<PreMarketType>): Buffer {
  return Buffer.from(
    // @ts-ignore — constants are present in the IDL at runtime
    JSON.parse(program.idl.constants.find((c: any) => c.name === name)!.value)
  );
}

function toBuf(value: BN, endian: 'be' | 'le' = 'be', len = 8): Buffer {
  try { return value.toBuffer(endian, len); }
  catch { return value.toArrayLike(Buffer, endian, len); }
}

function configPDA(program: Program<PreMarketType>, authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [getSeed('CONFIG_PDA_SEED', program), authority.toBuffer()],
    program.programId
  )[0];
}

function tokenConfigPDA(program: Program<PreMarketType>, config: PublicKey, id: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [getSeed('TOKEN_PDA_SEED', program), config.toBuffer(), toBuf(new BN(id), 'be', 2)],
    program.programId
  )[0];
}

function exTokenPDA(program: Program<PreMarketType>, config: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [getSeed('EX_TOKEN_PDA_SEED', program), config.toBuffer(), mint.toBuffer()],
    program.programId
  )[0];
}

function vaultTokenPDA(program: Program<PreMarketType>, config: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [getSeed('VAULT_TOKEN_PDA_SEED', program), config.toBuffer(), mint.toBuffer()],
    program.programId
  )[0];
}

function offerPDA(program: Program<PreMarketType>, config: PublicKey, offerId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [getSeed('OFFER_PDA_SEED', program), config.toBuffer(), toBuf(new BN(offerId), 'be', 8)],
    program.programId
  )[0];
}

function orderPDA(program: Program<PreMarketType>, config: PublicKey, orderId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [getSeed('ORDER_PDA_SEED', program), config.toBuffer(), toBuf(new BN(orderId), 'be', 8)],
    program.programId
  )[0];
}

// ── Main class ─────────────────────────────────────────────────────────────────

export class SolanaPreMarket {
  private program: Program<PreMarketType>;
  private connection: Connection;
  private keypair: Keypair;
  private configPubkey: PublicKey;
  private configAccount: anchor.IdlAccounts<PreMarketType>['configAccount'] | null = null;
  private apiUrl: string;

  constructor(
    connection: Connection,
    keypair: Keypair,
    isMainnet = true,
    apiUrl = 'https://api.whales.market'
  ) {
    this.connection = connection;
    this.keypair = keypair;
    this.apiUrl = apiUrl;

    const net = isMainnet ? PRE_MARKET.MAINNET : PRE_MARKET.DEVNET;

    const wallet = new anchor.Wallet(keypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    anchor.setProvider(provider);

    this.program = new anchor.Program(IDL as PreMarketType, new PublicKey(net.PROGRAM_ID), provider);
    this.configPubkey = new PublicKey(net.CONFIG_ACCOUNT);
  }

  private async fetchConfig(): Promise<anchor.IdlAccounts<PreMarketType>['configAccount']> {
    if (this.configAccount) return this.configAccount;
    this.configAccount = await this.program.account.configAccount.fetch(this.configPubkey, 'confirmed');
    return this.configAccount!;
  }

  /**
   * Simulate the transaction to estimate compute units, add a CU budget instruction
   * with a 25% buffer, then send with up to MAX_RETRIES retries on transient failures.
   */
  private async send(tx: Transaction, extraSigners: Keypair[] = []): Promise<TxResult> {
    const allSigners = [this.keypair, ...extraSigners];

    // Step 1: Simulate to estimate CU
    let cuLimit = 200_000;
    try {
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = this.keypair.publicKey;
      const simResult = await this.connection.simulateTransaction(tx);
      if (!simResult.value.err && simResult.value.unitsConsumed) {
        cuLimit = Math.ceil(simResult.value.unitsConsumed * 1.25);
      }
    } catch {
      // Fall back to default if simulation fails
    }

    // Step 2: Prepend CU budget instruction
    tx.instructions.unshift(
      ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit })
    );

    // Step 3: Send with retry
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        const txHash = await sendAndConfirmTransaction(
          this.connection,
          tx,
          allSigners,
          { commitment: 'confirmed' }
        );
        return { txHash, wait: async () => {} };
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }

    throw lastError ?? new Error('Transaction failed after max retries');
  }

  async getOffer(offerId: number): Promise<OfferData> {
    const raw = await this.program.account.offerAccount.fetch(
      offerPDA(this.program, this.configPubkey, offerId)
    );
    const statusKeys = Object.keys(raw.status as object);
    let status = OfferStatus.Open;
    if (statusKeys.includes('filled')) status = OfferStatus.Filled;
    if (statusKeys.includes('cancelled')) status = OfferStatus.Cancelled;

    return {
      totalAmount: raw.totalAmount.toNumber() / WEI6,
      filledAmount: raw.filledAmount.toNumber() / WEI6,
      collateral: {
        amount: raw.collateral.toString(),
        uiAmount: (raw.collateral.toNumber() / 1e6).toString(),
      },
      isFullMatch: raw.isFullMatch,
      status,
    };
  }

  async getOrder(orderId: number): Promise<OrderData> {
    const raw = await this.program.account.orderAccount.fetch(
      orderPDA(this.program, this.configPubkey, orderId)
    );
    const statusKeys = Object.keys(raw.status as object);
    let status = OrderStatus.Open;
    if (statusKeys.includes('settleFilled')) status = OrderStatus.SettleFilled;
    if (statusKeys.includes('settleCancelled')) status = OrderStatus.SettleCancelled;
    if (statusKeys.includes('cancelled')) status = OrderStatus.Cancelled;

    return {
      amount: raw.amount.toNumber() / WEI6,
      buyer: raw.buyer.toBase58(),
      seller: raw.seller.toBase58(),
      offerId: raw.offer.toBase58(), // `offer` is the PDA pubkey of the offer account
      status,
    };
  }

  // ── Offer lifecycle ─────────────────────────────────────────────────────────

  async createOffer(params: {
    tokenId: number;
    side: 'buy' | 'sell';
    exToken: PublicKey;
    amount: number;   // token units (human-readable)
    price: number;    // USD price per token in raw units (WEI6)
    isFullMatch: boolean;
  }): Promise<TxResult> {
    const config = await this.fetchConfig();
    let exToken = params.exToken;
    if (exToken.equals(PublicKey.default)) exToken = NATIVE_MINT;

    const tokenConfigAccountPubKey = tokenConfigPDA(this.program, this.configPubkey, params.tokenId);
    const tokenConfigData = await this.program.account.tokenConfigAccount.fetch(tokenConfigAccountPubKey);
    const vaultPDA = vaultTokenPDA(this.program, this.configPubkey, exToken);
    const exTokenAccPDA = exTokenPDA(this.program, this.configPubkey, exToken);

    const exTokenInfo = await this.connection.getParsedAccountInfo(exToken);
    if (!exTokenInfo.value) throw new Error(`Token not found: ${exToken.toBase58()}`);
    const tokenProgram = exTokenInfo.value.owner as PublicKey;

    const userATA = await getAssociatedTokenAddress(exToken, this.keypair.publicKey, false, tokenProgram);

    const rawAmount = new BN(Math.round(params.amount * WEI6));
    const rawPrice = new BN(Math.round(params.price));
    const collateral = rawAmount.mul(rawPrice).mul(tokenConfigData.pledgeRate)
      .div(new BN(WEI6)).div(new BN(WEI6));
    const value = rawAmount.mul(rawPrice).div(new BN(WEI6));
    const amountTransfer = params.side === 'buy' ? value.toNumber() : collateral.toNumber();

    // Use lastOfferId + 1 as new offer ID
    const freshConfig = await this.program.account.configAccount.fetch(this.configPubkey, 'processed');
    const offerId = freshConfig.lastOfferId.toNumber() + 1;
    const offerAccPDA = offerPDA(this.program, this.configPubkey, offerId);

    const ix = await this.program.methods
      .createOffer({ [params.side]: {} } as any, rawAmount, rawPrice, params.isFullMatch, new BN(offerId))
      .accounts({
        offerAccount: offerAccPDA,
        vaultTokenAccount: vaultPDA,
        configAccount: this.configPubkey,
        tokenConfigAccount: tokenConfigAccountPubKey,
        exTokenAccount: exTokenAccPDA,
        userTokenAccount: userATA,
        user: this.keypair.publicKey,
        exToken,
        authority: config.authority,
        tokenProgram,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    if (exToken.equals(NATIVE_MINT)) {
      const wrapTx = await buildWrapSolInstructions(this.connection, this.keypair.publicKey, amountTransfer);
      tx.instructions.unshift(...wrapTx.instructions);
    }

    return this.send(tx);
  }

  async fillOffer(params: {
    offerId: number;
    amount: number;
  }): Promise<TxResult> {
    const config = await this.fetchConfig();
    const offerAccPDA = offerPDA(this.program, this.configPubkey, params.offerId);
    const offer = await this.program.account.offerAccount.fetch(offerAccPDA);

    let exToken = offer.exToken;
    if (exToken.equals(PublicKey.default)) exToken = NATIVE_MINT;

    const vaultPDA = vaultTokenPDA(this.program, this.configPubkey, exToken);
    const exTokenAccPDA = exTokenPDA(this.program, this.configPubkey, exToken);

    const exTokenInfo = await this.connection.getParsedAccountInfo(exToken);
    if (!exTokenInfo.value) throw new Error(`Token not found: ${exToken.toBase58()}`);
    const tokenProgram = exTokenInfo.value.owner as PublicKey;

    const userATA = await getAssociatedTokenAddress(exToken, this.keypair.publicKey, false, tokenProgram);

    const freshConfig = await this.program.account.configAccount.fetch(this.configPubkey, 'processed');
    const newOrderId = freshConfig.lastOrderId.toNumber() + 1;
    const orderAccPDA = orderPDA(this.program, this.configPubkey, newOrderId);
    const rawAmount = new BN(Math.round(params.amount * WEI6));

    const ix = await this.program.methods
      .fillOffer(rawAmount, new BN(newOrderId))
      .accounts({
        orderAccount: orderAccPDA,
        offerAccount: offerAccPDA,
        vaultTokenAccount: vaultPDA,
        exTokenAccount: exTokenAccPDA,
        configAccount: this.configPubkey,
        tokenConfigAccount: offer.tokenConfig,
        userTokenAccount: userATA,
        user: this.keypair.publicKey,
        exToken,
        authority: config.authority,
        tokenProgram,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    if (exToken.equals(NATIVE_MINT)) {
      const offerSide = Object.keys(offer.offerType as object)[0];
      const amountTransfer =
        offerSide === 'buy'
          ? offer.collateral.mul(rawAmount).div(offer.totalAmount).toNumber()
          : offer.price.mul(rawAmount).div(new BN(WEI6)).toNumber();
      const wrapTx = await buildWrapSolInstructions(this.connection, this.keypair.publicKey, amountTransfer);
      tx.instructions.unshift(...wrapTx.instructions);
    }

    return this.send(tx);
  }

  async closeOffer(offerId: number): Promise<TxResult> {
    const config = await this.fetchConfig();
    const offerAccPDA = offerPDA(this.program, this.configPubkey, offerId);
    const offer = await this.program.account.offerAccount.fetch(offerAccPDA);

    let exToken = offer.exToken;
    if (exToken.equals(PublicKey.default)) exToken = NATIVE_MINT;

    const vaultPDA = vaultTokenPDA(this.program, this.configPubkey, exToken);
    const exTokenAccPDA = exTokenPDA(this.program, this.configPubkey, exToken);

    const exTokenInfo = await this.connection.getParsedAccountInfo(exToken);
    if (!exTokenInfo.value) throw new Error(`Token not found: ${exToken.toBase58()}`);
    const tokenProgram = exTokenInfo.value.owner as PublicKey;

    const userExTokenAccount = getAssociatedTokenAddressSync(exToken, this.keypair.publicKey, false, tokenProgram);
    const feeExTokenAccount = getAssociatedTokenAddressSync(exToken, config.feeWallet, false, tokenProgram);

    const ix = await this.program.methods
      .closeUnFullFilledOffer()
      .accounts({
        offerAccount: offerAccPDA,
        vaultExTokenAccount: vaultPDA,
        configAccount: this.configPubkey,
        tokenConfigAccount: offer.tokenConfig,
        feeExTokenAccount,
        userExTokenAccount,
        exTokenAccount: exTokenAccPDA,
        exToken,
        user: this.keypair.publicKey,
        feeWallet: config.feeWallet,
        configAuthority: config.authority,
        systemProgram: SystemProgram.programId,
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();

    return this.send(new Transaction().add(ix));
  }

  // ── Order lifecycle ─────────────────────────────────────────────────────────
  // settleOrder is called by the SELLER to deliver the settlement token to the buyer.

  async settleOrder(orderId: number): Promise<TxResult> {
    const config = await this.fetchConfig();
    const orderAccPDA = orderPDA(this.program, this.configPubkey, orderId);
    const order = await this.program.account.orderAccount.fetch(orderAccPDA);
    const offer = await this.program.account.offerAccount.fetch(order.offer);
    const tokenConfig = await this.program.account.tokenConfigAccount.fetch(offer.tokenConfig);

    const tokenInfo = await this.connection.getParsedAccountInfo(tokenConfig.token);
    if (!tokenInfo.value) throw new Error(`Settlement token not found: ${tokenConfig.token.toBase58()}`);
    const tokenProgram = tokenInfo.value.owner as PublicKey;

    let exToken = offer.exToken;
    if (exToken.equals(PublicKey.default)) exToken = NATIVE_MINT;
    const exTokenInfo = await this.connection.getParsedAccountInfo(exToken);
    if (!exTokenInfo.value) throw new Error(`ExToken not found: ${exToken.toBase58()}`);
    const exTokenProgram = exTokenInfo.value.owner as PublicKey;

    const vaultExTokenAccPDA = vaultTokenPDA(this.program, this.configPubkey, exToken);
    const exTokenAccPDA = exTokenPDA(this.program, this.configPubkey, exToken);
    const sellerExTokenATA = getAssociatedTokenAddressSync(exToken, order.seller, false, exTokenProgram);
    const feeExTokenATA = getAssociatedTokenAddressSync(exToken, config.feeWallet, false, exTokenProgram);
    const sellerTokenATA = getAssociatedTokenAddressSync(tokenConfig.token, order.seller, false, tokenProgram);
    const buyerTokenATA = getAssociatedTokenAddressSync(tokenConfig.token, order.buyer, false, tokenProgram);
    const feeTokenATA = getAssociatedTokenAddressSync(tokenConfig.token, config.feeWallet, false, tokenProgram);

    const finalTx = new Transaction();

    // Create any missing ATAs
    for (const [ata, mint, owner, prog] of [
      [feeExTokenATA, exToken, config.feeWallet, exTokenProgram],
      [buyerTokenATA, tokenConfig.token, order.buyer, tokenProgram],
      [feeTokenATA, tokenConfig.token, config.feeWallet, tokenProgram],
    ] as [PublicKey, PublicKey, PublicKey, PublicKey][]) {
      try { await getAccount(this.connection, ata, 'confirmed', prog); }
      catch {
        finalTx.add(createAssociatedTokenAccountInstruction(
          this.keypair.publicKey, ata, owner, mint, prog
        ));
      }
    }

    const ix = await this.program.methods
      .settleOrder()
      .accounts({
        orderAccount: orderAccPDA,
        offerAccount: order.offer,
        vaultExTokenAccount: vaultExTokenAccPDA,
        configAccount: this.configPubkey,
        tokenConfigAccount: offer.tokenConfig,
        feeExTokenAccount: feeExTokenATA,
        sellerExTokenAccount: sellerExTokenATA,
        exTokenAccount: exTokenAccPDA,
        exToken,
        sellerTokenAccount: sellerTokenATA,
        buyerTokenAccount: buyerTokenATA,
        feeTokenAccount: feeTokenATA,
        token: tokenConfig.token,
        seller: this.keypair.publicKey,
        buyer: order.buyer,
        feeWallet: config.feeWallet,
        configAuthority: config.authority,
        systemProgram: SystemProgram.programId,
        tokenProgram,
        exTokenProgram,
      })
      .instruction();

    finalTx.add(ix);
    return this.send(finalTx);
  }

  /**
   * Settle a filled order with a referral discount.
   * The backend builds and partially signs the transaction; we add our signature and send.
   */
  async settleOrderWithDiscount(params: { orderId: number }): Promise<TxResult> {
    const { data } = await axios.post(
      `${this.apiUrl}/transactions/build-transaction-settle-with-discount`,
      { orderId: params.orderId, feePayer: this.keypair.publicKey.toBase58() }
    );
    const txBytes = Buffer.from(data.data as string, 'base64');
    const versioned = VersionedTransaction.deserialize(txBytes);
    versioned.sign([this.keypair]);
    const txHash = await this.connection.sendRawTransaction(versioned.serialize());
    await this.connection.confirmTransaction(txHash, 'confirmed');
    return { txHash, wait: async () => {} };
  }

  // cancelOrder is called by the BUYER to cancel an unfilled order and reclaim collateral.
  async cancelOrder(orderId: number): Promise<TxResult> {
    const config = await this.fetchConfig();
    const orderAccPDA = orderPDA(this.program, this.configPubkey, orderId);
    const order = await this.program.account.orderAccount.fetch(orderAccPDA);
    const offer = await this.program.account.offerAccount.fetch(order.offer);

    let exToken = offer.exToken;
    if (exToken.equals(PublicKey.default)) exToken = NATIVE_MINT;

    const exTokenInfo = await this.connection.getParsedAccountInfo(exToken);
    if (!exTokenInfo.value) throw new Error(`Token not found: ${exToken.toBase58()}`);
    const tokenProgram = exTokenInfo.value.owner as PublicKey;

    const vaultPDA = vaultTokenPDA(this.program, this.configPubkey, exToken);
    const exTokenAccPDA = exTokenPDA(this.program, this.configPubkey, exToken);
    const buyerExTokenATA = getAssociatedTokenAddressSync(exToken, order.buyer, false, tokenProgram);
    const feeExTokenATA = getAssociatedTokenAddressSync(exToken, config.feeWallet, false, tokenProgram);

    const ix = await this.program.methods
      .cancelUnFilledOrder()
      .accounts({
        orderAccount: orderAccPDA,
        offerAccount: order.offer,
        vaultExTokenAccount: vaultPDA,
        configAccount: this.configPubkey,
        tokenConfigAccount: offer.tokenConfig,
        feeExTokenAccount: feeExTokenATA,
        buyerExTokenAccount: buyerExTokenATA,
        exTokenAccount: exTokenAccPDA,
        exToken,
        buyer: this.keypair.publicKey,
        feeWallet: config.feeWallet,
        configAuthority: config.authority,
        systemProgram: SystemProgram.programId,
        tokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();

    return this.send(new Transaction().add(ix));
  }

  /**
   * Cancel an unfilled order with a referral discount.
   * The backend builds and partially signs the transaction; we add our signature and send.
   */
  async cancelOrderWithDiscount(params: { orderId: number }): Promise<TxResult> {
    const { data } = await axios.post(
      `${this.apiUrl}/transactions/build-transaction-cancel-with-discount`,
      { orderId: params.orderId, feePayer: this.keypair.publicKey.toBase58() }
    );
    const txBytes = Buffer.from(data.data as string, 'base64');
    const versioned = VersionedTransaction.deserialize(txBytes);
    versioned.sign([this.keypair]);
    const txHash = await this.connection.sendRawTransaction(versioned.serialize());
    await this.connection.confirmTransaction(txHash, 'confirmed');
    return { txHash, wait: async () => {} };
  }
}
