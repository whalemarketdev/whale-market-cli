import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from './config';
import { ApiResponse } from './types';

export class ApiClient {
  private client: AxiosInstance;
  
  constructor() {
    const baseURL = (config.get('apiUrl') as string) || 'https://api.whales.market';
    
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Response interceptor: handle errors
    this.client.interceptors.response.use(
      response => response.data,
      (error: AxiosError) => {
        if (error.response?.data) {
          const data = error.response.data as any;
          throw new Error(data.message || data.error || error.message);
        }
        throw error;
      }
    );
  }
  
  async get<T>(url: string, params?: any, baseUrlOverride?: string): Promise<T> {
    if (baseUrlOverride) {
      const fullUrl = `${baseUrlOverride.replace(/\/$/, '')}${url.startsWith('/') ? url : '/' + url}`;
      const res = await axios.get(fullUrl, { params, timeout: 30000 });
      return res.data as T;
    }
    return this.client.get(url, { params });
  }
  
  async post<T>(url: string, data?: any): Promise<T> {
    return this.client.post(url, data);
  }
  
  async put<T>(url: string, data?: any): Promise<T> {
    return this.client.put(url, data);
  }
  
  async delete<T>(url: string): Promise<T> {
    return this.client.delete(url);
  }
  
  // Typed API methods for common endpoints
  async getTokens(params?: any): Promise<ApiResponse<any[]>> {
    return this.get('/tokens', params);
  }

  /**
   * Get tokens from V2 API - same as whales.market frontend
   * Endpoint: GET /v2/tokens
   * Returns: { data: { count, list: [...] } }
   */
  async getTokensV2(params?: any): Promise<ApiResponse<{ count: number; list: any[] }>> {
    return this.get('/v2/tokens', params);
  }
  
  /**
   * Get token by ID (UUID).
   * Uses V2 endpoint: GET /v2/tokens/detail/index/:id (compatible with dev & production)
   */
  async getToken(id: string): Promise<ApiResponse<any>> {
    return this.get(`/v2/tokens/detail/index/${id}`);
  }
  
  async getOffers(params?: any): Promise<ApiResponse<any[]>> {
    return this.get('/transactions/offers', params);
  }

  /**
   * Get offers from V2 API - used for order book (has more complete data)
   * Endpoint: GET /v2/offers
   */
  async getOffersV2(params?: any, baseUrlOverride?: string): Promise<ApiResponse<any[]>> {
    return this.get('/v2/offers', params, baseUrlOverride);
  }
  
  async getOffer(id: string, baseUrlOverride?: string): Promise<ApiResponse<any>> {
    return this.get(`/transactions/offers/${id}`, undefined, baseUrlOverride);
  }
  
  async getOffersByAddress(address: string): Promise<ApiResponse<any[]>> {
    const addr = address.startsWith('0x') ? address.toLowerCase() : address;
    return this.get(`/transactions/offers-by-address/${addr}`);
  }

  /**
   * Get simple offers by address from V2 API (my offers with filters)
   * Endpoint: GET /v2/simple-offers-by-address/:address
   * Params: symbol, category_token, page, take, is_by_me, status, chain_id, etc.
   */
  async getSimpleOffersByAddress(address: string, params?: any, baseUrlOverride?: string): Promise<ApiResponse<any>> {
    const addr = address.startsWith('0x') ? address.toLowerCase() : address;
    return this.get(`/v2/simple-offers-by-address/${addr}`, params, baseUrlOverride);
  }
  
  async getOrders(params?: any): Promise<ApiResponse<any[]>> {
    return this.get('/transactions/orders', params);
  }
  
  async getOrder(id: string): Promise<ApiResponse<any>> {
    return this.get(`/transactions/orders/${id}`);
  }
  
  async getOrdersByAddress(address: string, params?: any): Promise<ApiResponse<any[]>> {
    const addr = address.startsWith('0x') ? address.toLowerCase() : address;
    return this.get(`/transactions/orders-by-address/${addr}`, params);
  }

  /**
   * Get orders by address from V2 API (non-resell, with filters)
   * Endpoint: GET /v2/orders-by-address-non-resell/:address
   * Params: symbol, category_token, chain_id, page, take, etc.
   */
  async getOrdersByAddressV2(address: string, params?: any, baseUrlOverride?: string): Promise<ApiResponse<any>> {
    const addr = address.startsWith('0x') ? address.toLowerCase() : address;
    return this.get(`/v2/orders-by-address-non-resell/${addr}`, params, baseUrlOverride);
  }
  
  async getOrdersByOffer(address: string): Promise<ApiResponse<any[]>> {
    const addr = address.startsWith('0x') ? address.toLowerCase() : address;
    return this.get(`/transactions/orders-by-offer/${addr}`);
  }
  
  async getNetworks(): Promise<ApiResponse<any[]>> {
    return this.get('/network-chains');
  }
  
  async getOrderBookPositions(telegramId: string): Promise<ApiResponse<any[]>> {
    return this.get(`/order-books/position/${telegramId}`);
  }
  
  async getOrderBookPairs(telegramId: string): Promise<ApiResponse<any[]>> {
    return this.get(`/order-books/pairs/${telegramId}`);
  }
  
  async getOrderBookSnapshot(): Promise<ApiResponse<any>> {
    return this.get('/order-books/snapshot');
  }
  
  async getOrderBook(id: string): Promise<ApiResponse<any>> {
    return this.get(`/order-books/${id}`);
  }
  
  async getReferralCampaigns(address: string): Promise<ApiResponse<any[]>> {
    return this.get(`/referral/my-campaigns/${address}`);
  }
  
  async getReferralSummary(address: string): Promise<ApiResponse<any>> {
    return this.get(`/referral/my-campaigns/${address}/summary`);
  }
  
  async getReferralPerformance(address: string): Promise<ApiResponse<any[]>> {
    return this.get(`/referral/my-campaigns/${address}/performance`);
  }
  
  async getReferralTransactions(address: string): Promise<ApiResponse<any[]>> {
    return this.get(`/referral/my-campaigns/${address}/transactions`);
  }

  /**
   * Get exToken prices for collateral USD check (#1).
   * Endpoint: GET /network-chains/v2/price?chainId={chainId}&currency=usd
   * Returns: [{ address: string, price: number }]
   */
  async getExTokenPrices(chainId: number): Promise<Array<{ address: string; price: number }>> {
    const res = await this.get<any>('/network-chains/v2/price', { chainId, currency: 'usd' });
    return (res as any)?.data ?? res ?? [];
  }

  /**
   * Get Sui settle-with-discount signature from API (#13).
   * Endpoint: POST /transactions/build-settle-discount-signature-sui
   */
  async buildSuiSettleDiscount(orderUUID: string): Promise<any> {
    const res = await this.post<any>('/transactions/build-settle-discount-signature-sui', { orderId: orderUUID });
    return (res as any)?.data?.settleDiscount ?? (res as any)?.data;
  }

  /**
   * Get Sui cancel-with-discount signature from API (#14).
   * Endpoint: POST /transactions/build-cancel-discount-signature-sui
   * Returns: { order: { custom_index: string }, settleDiscount: { ... } }
   */
  async buildSuiCancelDiscount(orderUUID: string): Promise<{ order: { custom_index: string }; settleDiscount: any }> {
    const res = await this.post<any>('/transactions/build-cancel-discount-signature-sui', { orderId: orderUUID });
    return (res as any)?.data;
  }
}

export const apiClient = new ApiClient();
