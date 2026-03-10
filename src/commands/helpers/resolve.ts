import { Command } from 'commander';
import { apiClient } from '../../api';

/** Resolves chainId + on-chain token ID from GET /v2/tokens?ids={uuid} */
export async function resolveToken(uuid: string): Promise<{
  chainId: number;
  tokenId: string;
}> {
  const res: any = await apiClient.getTokensV2({
    ids: uuid,
    type: 'pre_market',
    category: 'pre_market',
    statuses: ['active', 'settling', 'ended'],
    take: 1,
    page: 1,
  });
  const list = res?.data?.list ?? res?.data ?? [];
  const token = list[0];
  const tokenId = token?.token_id;
  if (tokenId == null || String(tokenId).length === 0) {
    throw new Error(`Token ${uuid} not found or missing token_id`);
  }
  const chainIds: number[] = Array.isArray(token?.chain_id) ? token.chain_id : [token?.chain_id];
  const chainId = chainIds[0];
  if (!chainId) throw new Error(`Token ${uuid}: missing chain_id in API response`);
  return { chainId, tokenId: String(tokenId) };
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns undefined if --chain-id was not explicitly set */
export function getOptionalChainIdFromOpts(command: Command): number | undefined {
  const chainId = command.optsWithGlobals().chainId;
  if (chainId == null) return undefined;
  return typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
}

/** Resolves chainId + on-chain offer ID from GET /transactions/offers/{uuid} */
export async function resolveOffer(uuid: string): Promise<{
  chainId: number;
  offerIndex: string;
  customIndex: string | null;
}> {
  const res = await apiClient.getOffer(uuid);
  const o = (res as any)?.data ?? res;
  const chainId = o?.network?.chain_id;
  const offerIndex = o?.offer_index;
  const customIndex = o?.custom_index ?? null;
  if (!chainId) throw new Error(`Offer ${uuid}: missing network.chain_id in API response`);
  if (offerIndex == null) throw new Error(`Offer ${uuid}: missing offer_index in API response`);
  return { chainId, offerIndex: String(offerIndex), customIndex };
}

/** Resolves chainId + on-chain OTC offer ID (exit_position_index) from GET /transactions/offers/{uuid} */
export async function resolveOtcOffer(uuid: string): Promise<{
  chainId: number;
  exitPositionIndex: string;
}> {
  const res = await apiClient.getOffer(uuid);
  const o = (res as any)?.data ?? res;
  const chainId = o?.network?.chain_id;
  const exitPositionIndex = o?.exit_position_index;
  if (!chainId) throw new Error(`OTC offer ${uuid}: missing network.chain_id in API response`);
  if (!exitPositionIndex) throw new Error(`OTC offer ${uuid}: missing exit_position_index in API response`);
  return { chainId, exitPositionIndex: String(exitPositionIndex) };
}

/** Resolves chainId + on-chain order ID from GET /transactions/orders/{uuid} */
export async function resolveOrder(uuid: string): Promise<{
  chainId: number;
  orderIndex: string;
  customIndex: string | null;
}> {
  const res = await apiClient.getOrder(uuid);
  const o = (res as any)?.data ?? res;
  const chainId = o?.chain_id ?? o?.network?.chain_id;
  const orderIndex = o?.order_index;
  const customIndex = o?.custom_index ?? null;
  if (!chainId) throw new Error(`Order ${uuid}: missing chain_id in API response`);
  if (orderIndex == null) throw new Error(`Order ${uuid}: missing order_index in API response`);
  return { chainId, orderIndex: String(orderIndex), customIndex };
}
