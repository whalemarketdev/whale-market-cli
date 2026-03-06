import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { deriveSolanaKeypair } from './signer';
import { ChainAdapter } from '../types';

export { SolanaPreMarket } from './programs/PreMarket';
export { SolanaOtcPreMarket } from './programs/OtcPreMarket';

export class SolanaAdapter implements ChainAdapter {
  readonly chain = 'solana' as const;
  private rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
  }

  async getAddress(mnemonic: string): Promise<string> {
    return deriveSolanaKeypair(mnemonic).publicKey.toBase58();
  }

  async getBalance(address: string, tokenMint?: string): Promise<string> {
    const connection = new Connection(this.rpcUrl, 'confirmed');
    const pubkey = new PublicKey(address);

    if (!tokenMint || tokenMint === PublicKey.default.toBase58()) {
      const lamports = await connection.getBalance(pubkey);
      return (lamports / LAMPORTS_PER_SOL).toString();
    }

    const mint = new PublicKey(tokenMint);
    const ata = getAssociatedTokenAddressSync(mint, pubkey);
    try {
      const account = await getAccount(connection, ata);
      return account.amount.toString();
    } catch {
      return '0';
    }
  }
}
