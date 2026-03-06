import { SuiClient } from '@mysten/sui/client';
import { deriveSuiKeypair, deriveSuiAddress } from './signer';
import { ChainAdapter } from '../types';

export { SuiPreMarket } from './contracts/PreMarket';
export { SuiOtcPreMarket } from './contracts/OtcPreMarket';
export { deriveSuiKeypair, deriveSuiAddress } from './signer';

export class SuiAdapter implements ChainAdapter {
  readonly chain = 'sui' as const;
  private rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
  }

  async getAddress(mnemonic: string): Promise<string> {
    return deriveSuiAddress(mnemonic);
  }

  async getBalance(address: string, coinType?: string): Promise<string> {
    const client = new SuiClient({ url: this.rpcUrl });
    const type = coinType ?? '0x2::sui::SUI';
    const balance = await client.getBalance({ owner: address, coinType: type });
    return balance.totalBalance;
  }
}
