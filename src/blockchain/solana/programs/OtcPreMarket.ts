import * as anchor from '@coral-xyz/anchor';
import { BN, Program } from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { IDL as OtcIDL, OtcPreMarketType } from './idl/otc_pre_market';
import { IDL as PreMarketIDL, PreMarketType } from './idl/pre_market';
import { OTC_PRE_MARKET, PRE_MARKET } from '../constants';
import { TxResult } from '../../types';

// Derive the OTC config PDA from the config index
function getOtcConfigPDA(program: Program<OtcPreMarketType>, configIndex: number): PublicKey {
  const seed = Buffer.from(
    // @ts-ignore
    JSON.parse(program.idl.constants.find((c: any) => c.name === 'CONFIG_SEED')!.value)
  );
  const indexBuffer = Buffer.alloc(1);
  indexBuffer.writeUInt8(configIndex);
  return PublicKey.findProgramAddressSync([seed, indexBuffer], program.programId)[0];
}

// Derive a pre-market order PDA from orderId
function getPreMarketOrderPDA(
  program: Program<PreMarketType>,
  config: PublicKey,
  orderId: number
): PublicKey {
  const orderSeed = Buffer.from(
    // @ts-ignore
    JSON.parse(program.idl.constants.find((c: any) => c.name === 'ORDER_PDA_SEED')!.value)
  );
  let orderIdBuf: Buffer;
  try {
    orderIdBuf = new BN(orderId).toBuffer('be', 8);
  } catch {
    orderIdBuf = new BN(orderId).toArrayLike(Buffer, 'be', 8);
  }
  return PublicKey.findProgramAddressSync(
    [orderSeed, config.toBuffer(), orderIdBuf],
    program.programId
  )[0];
}

// Derive the pre-market exToken PDA
function getPreMarketExTokenPDA(
  program: Program<PreMarketType>,
  config: PublicKey,
  mint: PublicKey
): PublicKey {
  const seed = Buffer.from(
    // @ts-ignore
    JSON.parse(program.idl.constants.find((c: any) => c.name === 'EX_TOKEN_PDA_SEED')!.value)
  );
  return PublicKey.findProgramAddressSync(
    [seed, config.toBuffer(), mint.toBuffer()],
    program.programId
  )[0];
}

export class SolanaOtcPreMarket {
  private program: Program<OtcPreMarketType>;
  private preMarketProgram: Program<PreMarketType>;
  private connection: Connection;
  private keypair: Keypair;
  private configPubkey: PublicKey;
  private preMarketConfigPubkey: PublicKey;
  private configIndex: number;
  private preMarketConfigAccount: anchor.IdlAccounts<PreMarketType>['configAccount'] | null = null;

  constructor(connection: Connection, keypair: Keypair, isMainnet = true) {
    this.connection = connection;
    this.keypair = keypair;

    const otcNet = isMainnet ? OTC_PRE_MARKET.MAINNET : OTC_PRE_MARKET.DEVNET;
    const pmNet = isMainnet ? PRE_MARKET.MAINNET : PRE_MARKET.DEVNET;

    const wallet = new anchor.Wallet(keypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });

    this.program = new anchor.Program(OtcIDL as OtcPreMarketType, new PublicKey(otcNet.PROGRAM_ID), provider);
    this.preMarketProgram = new anchor.Program(
      PreMarketIDL as PreMarketType,
      new PublicKey(pmNet.PROGRAM_ID),
      provider
    );

    this.configIndex = otcNet.CONFIG_INDEX;
    this.configPubkey = getOtcConfigPDA(this.program, this.configIndex);
    this.preMarketConfigPubkey = new PublicKey(pmNet.CONFIG_ACCOUNT);
  }

  private async fetchPreMarketConfig(): Promise<anchor.IdlAccounts<PreMarketType>['configAccount']> {
    if (this.preMarketConfigAccount) return this.preMarketConfigAccount;
    this.preMarketConfigAccount = await this.preMarketProgram.account.configAccount.fetch(
      this.preMarketConfigPubkey,
      'confirmed'
    );
    return this.preMarketConfigAccount!;
  }

  private async sendTransaction(tx: Transaction): Promise<TxResult> {
    const txHash = await sendAndConfirmTransaction(this.connection, tx, [this.keypair], {
      commitment: 'confirmed',
    });
    return { txHash, wait: async () => {} };
  }

  /**
   * Create an OTC offer for a pre-market order position.
   * The signer must be the buyer of the pre-market order.
   */
  async createOffer(params: {
    orderId: number;
    exToken: PublicKey;
    value: BN;     // price offered in exToken raw units
    deadline: BN;  // unix timestamp BN
  }): Promise<TxResult> {
    const pmConfig = await this.fetchPreMarketConfig();

    const orderPDA = getPreMarketOrderPDA(
      this.preMarketProgram,
      this.preMarketConfigPubkey,
      params.orderId
    );
    const orderData = await this.preMarketProgram.account.orderAccount.fetch(orderPDA, 'confirmed');

    const isBuyer = orderData.buyer.equals(this.keypair.publicKey);

    const offerData = await this.preMarketProgram.account.offerAccount.fetch(
      orderData.offer,
      'confirmed'
    );
    const exTokenPDA = getPreMarketExTokenPDA(
      this.preMarketProgram,
      this.preMarketConfigPubkey,
      params.exToken
    );

    const exTokenInfo = await this.connection.getAccountInfo(params.exToken);
    if (!exTokenInfo) throw new Error(`ExToken not found: ${params.exToken.toBase58()}`);

    const otcOfferKeypair = Keypair.generate();

    const ix = await this.program.methods
      .createOffer(params.value, params.deadline, isBuyer)
      .accounts({
        buyerOrSeller: this.keypair.publicKey,
        config: this.configPubkey,
        otcOffer: otcOfferKeypair.publicKey,
        preMarketConfig: this.preMarketConfigPubkey,
        configAuthority: pmConfig.authority,
        orderAccount: orderPDA,
        offerAccount: orderData.offer,
        tokenConfigAccount: offerData.tokenConfig,
        exTokenAccount: exTokenPDA,
        exToken: params.exToken,
        exTokenProgram: exTokenInfo.owner,
        systemProgram: SystemProgram.programId,
        preMarket: this.preMarketProgram.programId,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    const txHash = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.keypair, otcOfferKeypair],
      { commitment: 'confirmed' }
    );

    return { txHash, wait: async () => {} };
  }

  /**
   * Fill an OTC offer — becomes the new buyer of the pre-market order position.
   */
  async fillOffer(otcOfferPubkey: PublicKey): Promise<TxResult> {
    const pmConfig = await this.fetchPreMarketConfig();
    const otcOffer = await this.program.account.otcOffer.fetch(otcOfferPubkey, 'confirmed');

    // `order` is the pre-market order account pubkey stored in the otcOffer
    const orderData = await this.preMarketProgram.account.orderAccount.fetch(
      otcOffer.order,
      'confirmed'
    );
    const offerData = await this.preMarketProgram.account.offerAccount.fetch(
      orderData.offer,
      'confirmed'
    );

    let exToken = otcOffer.exToken;
    if (!exToken || exToken.equals(PublicKey.default)) exToken = NATIVE_MINT;

    const exTokenInfo = await this.connection.getAccountInfo(exToken);
    if (!exTokenInfo) throw new Error(`ExToken not found: ${exToken.toBase58()}`);
    const tokenProgram = exTokenInfo.owner;

    // ATA for user (filler) and offer authority (creator)
    const userExAta = getAssociatedTokenAddressSync(exToken, this.keypair.publicKey, false, tokenProgram);
    const offerAuthorityExAta = getAssociatedTokenAddressSync(
      exToken,
      otcOffer.authority,
      false,
      tokenProgram
    );

    // Fetch the OTC config to get feeWallet
    const otcConfig = await this.program.account.config.fetch(this.configPubkey, 'confirmed');
    const feeExAta = getAssociatedTokenAddressSync(exToken, otcConfig.feeWallet, false, tokenProgram);

    const ix = await this.program.methods
      .fillOffer()
      .accounts({
        user: this.keypair.publicKey,
        userExAta,
        offerAuthorityExAta,
        feeExAta,
        config: this.configPubkey,
        otcOffer: otcOfferPubkey,
        preMarketConfig: this.preMarketConfigPubkey,
        configAuthority: pmConfig.authority,
        orderAccount: otcOffer.order,
        offerAccount: orderData.offer,
        tokenConfigAccount: offerData.tokenConfig,
        exToken,
        exTokenProgram: tokenProgram,
        preMarket: this.preMarketProgram.programId,
      })
      .instruction();

    return this.sendTransaction(new Transaction().add(ix));
  }

  /**
   * Cancel an OTC offer — reclaim the pre-market order position.
   */
  async cancelOffer(otcOfferPubkey: PublicKey): Promise<TxResult> {
    const pmConfig = await this.fetchPreMarketConfig();
    const otcOffer = await this.program.account.otcOffer.fetch(otcOfferPubkey, 'confirmed');

    const ix = await this.program.methods
      .cancelOffer()
      .accounts({
        user: this.keypair.publicKey,
        config: this.configPubkey,
        otcOffer: otcOfferPubkey,
        preMarketConfig: this.preMarketConfigPubkey,
        configAuthority: pmConfig.authority,
        orderAccount: otcOffer.order,
        preMarket: this.preMarketProgram.programId,
      })
      .instruction();

    return this.sendTransaction(new Transaction().add(ix));
  }
}
