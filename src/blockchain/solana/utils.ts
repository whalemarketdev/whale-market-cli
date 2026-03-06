import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createSyncNativeInstruction,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Keypair } from '@solana/web3.js';

// Wraps SOL into wSOL for use in SPL token accounts.
// Returns instructions that must be prepended to a transaction.
export async function buildWrapSolInstructions(
  connection: Connection,
  payer: PublicKey,
  lamports: number
): Promise<Transaction> {
  const tx = new Transaction();
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, payer);

  let ataExists = false;
  try {
    await getAccount(connection, ata);
    ataExists = true;
  } catch {
    // ATA does not exist yet
  }

  if (!ataExists) {
    tx.add(
      createAssociatedTokenAccountInstruction(payer, ata, payer, NATIVE_MINT)
    );
  }

  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: ata,
      lamports,
    }),
    createSyncNativeInstruction(ata)
  );

  return tx;
}

// Checks whether an associated token account exists for (mint, owner).
export async function ataExists(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
): Promise<boolean> {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, tokenProgram);
  try {
    await getAccount(connection, ata, 'confirmed', tokenProgram);
    return true;
  } catch {
    return false;
  }
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}
