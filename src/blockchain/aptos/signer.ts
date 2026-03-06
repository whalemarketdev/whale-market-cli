import { Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

const APTOS_DERIVATION_PATH = "m/44'/637'/0'/0'/0'";

export function deriveAptosAccount(mnemonic: string): Account {
  const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
  const { key } = derivePath(APTOS_DERIVATION_PATH, seed.toString('hex'));
  const keyBytes = Buffer.isBuffer(key) ? new Uint8Array(key) : key;
  const privateKey = new Ed25519PrivateKey(keyBytes.slice(0, 32));
  return Account.fromPrivateKey({ privateKey });
}

export function deriveAptosAddress(mnemonic: string): string {
  return deriveAptosAccount(mnemonic).accountAddress.toString();
}
