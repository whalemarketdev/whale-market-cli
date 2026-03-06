import { ethers } from 'ethers';
import { deriveEvmWallet } from './signer';
import { ChainAdapter } from '../types';
import { ERC20_ABI } from './contracts/abis/ERC20';
import { ETH_ADDRESS } from './utils';

export { EvmPreMarket } from './contracts/PreMarket';
export { EvmOtcPreMarket } from './contracts/OtcPreMarket';

export class EvmAdapter implements ChainAdapter {
  readonly chain = 'evm' as const;
  private rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
  }

  async getAddress(mnemonic: string): Promise<string> {
    return deriveEvmWallet(mnemonic).address;
  }

  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);

    if (!tokenAddress || tokenAddress === ETH_ADDRESS) {
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    }

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [balance, decimals] = await Promise.all([
      token.balanceOf(address),
      token.decimals(),
    ]);
    return ethers.formatUnits(balance, decimals);
  }
}
