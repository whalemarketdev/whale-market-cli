// OTC Pre-market support on Sui is planned but not yet exposed on the frontend.
// This file is a placeholder for future implementation.

export class SuiOtcPreMarket {
  constructor(_rpcUrl: string, _keypair: unknown) {}

  async createOffer(_params: unknown): Promise<never> {
    throw new Error('OTC Pre-market on Sui is not yet implemented');
  }

  async fillOffer(_offerId: string): Promise<never> {
    throw new Error('OTC Pre-market on Sui is not yet implemented');
  }

  async cancelOffer(_offerId: string): Promise<never> {
    throw new Error('OTC Pre-market on Sui is not yet implemented');
  }
}
