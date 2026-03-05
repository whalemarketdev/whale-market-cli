import { Keypair } from '@solana/web3.js';
import { HDNodeWallet, Wallet } from 'ethers';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';

const EVM_DERIVATION_PATH = "m/44'/60'/0'/0/0";
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export function generateMnemonic(): string {
  return bip39.generateMnemonic();
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

export function deriveEvmAddress(mnemonic: string): string {
  const wallet = HDNodeWallet.fromPhrase(mnemonic.trim(), undefined, EVM_DERIVATION_PATH);
  return wallet.address;
}

export function deriveSolanaAddress(mnemonic: string): string {
  const keypair = deriveSolanaKeypair(mnemonic);
  return keypair.publicKey.toBase58();
}

export function deriveSolanaKeypair(mnemonic: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
  const { key } = derivePath(SOLANA_DERIVATION_PATH, seed.toString('hex'));
  const keyBytes = Buffer.isBuffer(key) ? new Uint8Array(key) : key;
  return Keypair.fromSeed(keyBytes.slice(0, 32));
}

export function deriveEvmWallet(mnemonic: string): HDNodeWallet {
  return HDNodeWallet.fromPhrase(mnemonic.trim(), undefined, EVM_DERIVATION_PATH);
}

export interface DerivedAddresses {
  evm: string;
  solana: string;
}

export function deriveAllAddresses(mnemonic: string): DerivedAddresses {
  return {
    evm: deriveEvmAddress(mnemonic),
    solana: deriveSolanaAddress(mnemonic)
  };
}

export function createWallet(): { mnemonic: string; addresses: DerivedAddresses } {
  const mnemonic = generateMnemonic();
  const addresses = deriveAllAddresses(mnemonic);
  return { mnemonic, addresses };
}

// Legacy: import by private key (for backward compat during migration)
export function importSolanaWallet(privateKey: string): { address: string } {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    return { address: keypair.publicKey.toBase58() };
  } catch (error) {
    throw new Error('Invalid Solana private key format');
  }
}

export function importEvmWallet(privateKey: string): { address: string } {
  try {
    const wallet = new Wallet(privateKey);
    return { address: wallet.address };
  } catch (error) {
    throw new Error('Invalid EVM private key format');
  }
}
