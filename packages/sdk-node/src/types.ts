export interface KeyzenOptions {
  token?: string;
  endpoint?: string;
  cacheTtlMs?: number;
  autoRefresh?: boolean;
}

export interface ResolveResponse {
  environment: string;
  count: number;
  secrets: Record<string, string>;
}
