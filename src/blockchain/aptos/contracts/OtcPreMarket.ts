// OTC Pre-market on Aptos is planned but not yet exposed on the frontend.
// This file is a placeholder for future implementation.

export class AptosOtcPreMarket {
  constructor(_account: unknown, _network?: unknown) {}

  async createOffer(_params: unknown): Promise<never> {
    throw new Error('OTC Pre-market on Aptos is not yet implemented');
  }

  async fillOffer(_offerId: string): Promise<never> {
    throw new Error('OTC Pre-market on Aptos is not yet implemented');
  }

  async cancelOffer(_offerId: string): Promise<never> {
    throw new Error('OTC Pre-market on Aptos is not yet implemented');
  }
}
