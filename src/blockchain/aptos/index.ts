import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { deriveAptosAccount, deriveAptosAddress } from './signer';
import { ChainAdapter } from '../types';

export { AptosPreMarket } from './contracts/PreMarket';
export { AptosOtcPreMarket } from './contracts/OtcPreMarket';
export { deriveAptosAddress } from './signer';

export class AptosAdapter implements ChainAdapter {
  readonly chain = 'aptos' as const;
  private network: Network;
  private fullnode?: string;

  constructor(network: Network = Network.MAINNET, fullnode?: string) {
    this.network = network;
    this.fullnode = fullnode;
  }

  async getAddress(mnemonic: string): Promise<string> {
    return deriveAptosAddress(mnemonic);
  }

  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    const config = new AptosConfig({ network: this.network, fullnode: this.fullnode });
    const aptos = new Aptos(config);

    if (!tokenAddress || tokenAddress === '0x1::aptos_coin::AptosCoin') {
      const resources = await aptos.getAccountResources({ accountAddress: address });
      const coinStore = resources.find((r) =>
        r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
      );
      const rawBalance = (coinStore?.data as any)?.coin?.value ?? '0';
      // APT has 8 decimals
      return (Number(rawBalance) / 1e8).toString();
    }

    // Fungible Asset balance
    try {
      const balance = await aptos.getCurrentFungibleAssetBalances({
        options: {
          where: {
            owner_address: { _eq: address },
            asset_type: { _eq: tokenAddress },
          },
        },
      });
      return balance[0]?.amount?.toString() ?? '0';
    } catch {
      return '0';
    }
  }
}
