import { SuiClient } from '@mysten/sui/client';
import { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';

// Extract the phantom type parameter from a Sui object type string.
// E.g. "0x...::whales_premarket::Offer<0x2::sui::SUI>" → "0x2::sui::SUI"
export function extractPhantomType(typeStr: string | undefined): string {
  if (!typeStr) throw new Error('Cannot extract phantom type from undefined');
  const match = typeStr.match(/<(.+)>$/);
  if (!match) throw new Error(`No type parameter found in: ${typeStr}`);
  return match[1];
}

// Split a coin of the given type to produce exactly `amount` from the sender's wallet.
// Adds the necessary transaction commands and returns the resulting coin object.
export async function checkAndSplitCoin(
  client: SuiClient,
  tx: Transaction,
  sender: string,
  coinType: string,
  amount: bigint
): Promise<TransactionObjectArgument> {
  if (coinType === '0x2::sui::SUI') {
    // Use gas coin for SUI
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
    return coin;
  }

  // Fetch all coins of the given type owned by the sender
  const coins = await client.getCoins({ owner: sender, coinType });
  if (coins.data.length === 0) {
    throw new Error(`No coins of type ${coinType} found for ${sender}`);
  }

  if (coins.data.length === 1) {
    const [coin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [tx.pure.u64(amount)]);
    return coin;
  }

  // Merge all coins into the first then split
  const primary = tx.object(coins.data[0].coinObjectId);
  tx.mergeCoins(
    primary,
    coins.data.slice(1).map((c) => tx.object(c.coinObjectId))
  );
  const [coin] = tx.splitCoins(primary, [tx.pure.u64(amount)]);
  return coin;
}
