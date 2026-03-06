import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as bip39 from 'bip39';

const SUI_DERIVATION_PATH = "m/44'/784'/0'/0'/0'";

export function deriveSuiKeypair(mnemonic: string): Ed25519Keypair {
  return Ed25519Keypair.deriveKeypair(mnemonic.trim(), SUI_DERIVATION_PATH);
}

export function deriveSuiAddress(mnemonic: string): string {
  return deriveSuiKeypair(mnemonic).getPublicKey().toSuiAddress();
}
