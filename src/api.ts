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
  
  async get<T>(url: string, params?: any): Promise<T> {
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
  async getOffersV2(params?: any): Promise<ApiResponse<any[]>> {
    return this.get('/v2/offers', params);
  }
  
  async getOffer(id: string): Promise<ApiResponse<any>> {
    return this.get(`/transactions/offers/${id}`);
  }
  
  async getOffersByAddress(address: string): Promise<ApiResponse<any[]>> {
    return this.get(`/transactions/offers-by-address/${address}`);
  }
  
  async getOrders(params?: any): Promise<ApiResponse<any[]>> {
    return this.get('/transactions/orders', params);
  }
  
  async getOrder(id: string): Promise<ApiResponse<any>> {
    return this.get(`/transactions/orders/${id}`);
  }
  
  async getOrdersByAddress(address: string): Promise<ApiResponse<any[]>> {
    return this.get(`/transactions/orders-by-address/${address}`);
  }
  
  async getOrdersByOffer(address: string): Promise<ApiResponse<any[]>> {
    return this.get(`/transactions/orders-by-offer/${address}`);
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
}

export const apiClient = new ApiClient();
