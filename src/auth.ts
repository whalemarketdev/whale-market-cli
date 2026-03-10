import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { config } from './config';
import { deriveSolanaKeypair, deriveEvmWallet, deriveEvmAddress, deriveSolanaAddress } from './utils/wallet';

const SOLANA_CHAIN_ID = 666666;

function getChainId(): number {
  const chainId = config.get('chainId');
  return typeof chainId === 'number' ? chainId : SOLANA_CHAIN_ID;
}

function getMnemonic(): string {
  const wallet = config.getActiveWallet();
  if (wallet?.mnemonic) {
    return wallet.mnemonic;
  }
  if (config.hasLegacyPrivateKey()) {
    throw new Error(
      'Legacy private key config detected. Please run: whales wallet import "<your-mnemonic>" --name default'
    );
  }
  throw new Error('No wallet configured. Run: whales setup or whales wallet create');
}

export class Auth {
  getWallet(mnemonicOverride?: string, chainIdOverride?: number): { address: string; type: 'solana' | 'evm' } {
    const mnemonic = mnemonicOverride ?? getMnemonic();
    const chainId = chainIdOverride ?? getChainId();
    const type = chainId === SOLANA_CHAIN_ID ? 'solana' : 'evm';

    if (type === 'solana') {
      const address = deriveSolanaAddress(mnemonic);
      return { address, type: 'solana' };
    } else {
      const address = deriveEvmAddress(mnemonic);
      return { address, type: 'evm' };
    }
  }

  async signTransaction(transaction: any, mnemonicOverride?: string): Promise<string> {
    const mnemonic = mnemonicOverride ?? getMnemonic();
    const chainId = getChainId();

    if (chainId === SOLANA_CHAIN_ID) {
      const keypair = deriveSolanaKeypair(mnemonic);
      transaction.sign([keypair]);
      return transaction.serialize().toString('base64');
    } else {
      const wallet = deriveEvmWallet(mnemonic);
      return await wallet.signTransaction(transaction);
    }
  }

  async signMessage(message: string, mnemonicOverride?: string): Promise<string> {
    const mnemonic = mnemonicOverride ?? getMnemonic();
    const chainId = getChainId();

    if (chainId === SOLANA_CHAIN_ID) {
      const keypair = deriveSolanaKeypair(mnemonic);
      const messageBytes = Buffer.from(message);
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
      return bs58.encode(signature);
    } else {
      const wallet = deriveEvmWallet(mnemonic);
      return await wallet.signMessage(message);
    }
  }

  getAddress(mnemonicOverride?: string, chainIdOverride?: number): string {
    return this.getWallet(mnemonicOverride, chainIdOverride).address;
  }
}

export const auth = new Auth();
