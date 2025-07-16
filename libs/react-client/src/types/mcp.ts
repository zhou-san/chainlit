export interface IMcp {
  name: string;
  tools: [{ name: string }];
  status: 'connected' | 'connecting' | 'failed';
  clientType: 'sse' | 'stdio';
  command?: string;
  url?: string;
  /** Optional HTTP headers used when connecting (SSE or streamable-http) */
  headers?: Record<string, string>;
}
