import Conf from 'conf';

export interface WalletEntry {
  name: string;
  mnemonic: string;
  createdAt: string;
}

interface ConfigSchema {
  wallets?: WalletEntry[];
  activeWallet?: string;
  chainId?: number;
  apiUrl?: string;
  jwtToken?: string;
  jwtExpiresAt?: string;
  customRpcs?: Record<string, string>;
}

export class Config {
  private store: Conf<ConfigSchema>;
  
  constructor() {
    this.store = new Conf<ConfigSchema>({
      projectName: 'whales-market-cli',
      defaults: {
        apiUrl: 'https://api.whales.market',
        chainId: 666666,
        wallets: [],
        activeWallet: undefined
      }
    });
  }
  
  // Get config with priority: CLI flag > env var > config file
  get(key: keyof ConfigSchema, cliValue?: string): ConfigSchema[keyof ConfigSchema] {
    if (cliValue) return cliValue as ConfigSchema[keyof ConfigSchema];
    
    const envKey = `WHALES_${key.toUpperCase().replace(/([A-Z])/g, '_$1')}`;
    const envValue = process.env[envKey];
    if (envValue) {
      if (key === 'chainId') {
        return parseInt(envValue, 10) as ConfigSchema[keyof ConfigSchema];
      }
      return envValue as ConfigSchema[keyof ConfigSchema];
    }
    
    return this.store.get(key) as ConfigSchema[keyof ConfigSchema];
  }
  
  set(key: keyof ConfigSchema, value: any): void {
    this.store.set(key, value);
  }
  
  getAll(): ConfigSchema {
    return this.store.store;
  }
  
  getPath(): string {
    return this.store.path;
  }
  
  clear(): void {
    this.store.clear();
  }

  getWallets(): WalletEntry[] {
    return this.store.get('wallets') ?? [];
  }

  getActiveWallet(): WalletEntry | undefined {
    const name = this.store.get('activeWallet');
    if (!name) return undefined;
    return this.getWallets().find(w => w.name === name);
  }

  addWallet(entry: WalletEntry): void {
    const wallets = this.getWallets();
    if (wallets.some(w => w.name === entry.name)) {
      throw new Error(`Wallet "${entry.name}" already exists`);
    }
    this.store.set('wallets', [...wallets, entry]);
  }

  removeWallet(name: string): void {
    const wallets = this.getWallets().filter(w => w.name !== name);
    this.store.set('wallets', wallets);
    if (this.store.get('activeWallet') === name) {
      if (wallets.length > 0) {
        this.store.set('activeWallet', wallets[0].name);
      } else {
        this.store.delete('activeWallet');
      }
    }
  }

  setActiveWallet(name: string): void {
    const wallets = this.getWallets();
    if (!wallets.some(w => w.name === name)) {
      throw new Error(`Wallet "${name}" not found`);
    }
    this.store.set('activeWallet', name);
  }

  getCustomRpcs(): Record<string, string> {
    return this.store.get('customRpcs') ?? {};
  }

  getCustomRpc(chainId: number): string | undefined {
    return this.getCustomRpcs()[chainId.toString()];
  }

  setCustomRpc(chainId: number, url: string): void {
    const rpcs = this.getCustomRpcs();
    rpcs[chainId.toString()] = url;
    this.store.set('customRpcs', rpcs);
  }

  removeCustomRpc(chainId: number): void {
    const rpcs = this.getCustomRpcs();
    delete rpcs[chainId.toString()];
    this.store.set('customRpcs', rpcs);
  }

  hasLegacyPrivateKey(): boolean {
    const store = this.store.store as Record<string, unknown>;
    return typeof store.privateKey === 'string' && store.privateKey.length > 0;
  }
}

export const config = new Config();
