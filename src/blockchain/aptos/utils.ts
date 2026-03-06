import { Aptos } from '@aptos-labs/ts-sdk';

// Determine whether a token address uses the legacy Coin model or the new
// Fungible Asset (FA) model. Returns the coin type string if Coin, or null if FA.
export async function checkCoinToFa(
  aptos: Aptos,
  _sender: string,
  tokenAddress: string
): Promise<{ useCoin: boolean; coinType: string }> {
  // APT native coin sentinel
  if (
    tokenAddress === '0x1::aptos_coin::AptosCoin' ||
    tokenAddress === '0xa'
  ) {
    return { useCoin: true, coinType: '0x1::aptos_coin::AptosCoin' };
  }

  try {
    // If the address looks like a full module path it is a Coin type
    if (tokenAddress.includes('::')) {
      return { useCoin: true, coinType: tokenAddress };
    }

    // Check if there is coin info registered at this address
    const resources = await aptos.getAccountResources({
      accountAddress: tokenAddress,
    });
    const hasCoinStore = resources.some((r) => r.type.startsWith('0x1::coin::CoinStore'));
    if (hasCoinStore) {
      return { useCoin: true, coinType: tokenAddress };
    }
  } catch {
    // ignore
  }

  return { useCoin: false, coinType: '' };
}
