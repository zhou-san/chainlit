/**
 * Fixed-Window Token Batcher
 * 
 * Collects tokens in fixed time windows to prevent UI freezing 
 * during high-frequency streaming by batching rapid token updates.
 */

export interface BatcherConfig {
  batchWindow: number;        // Time window for collecting tokens (ms)
}

export class TokenBatcher {
  private buffer = '';
  private flushTimeout: NodeJS.Timeout | null = null;
  private onBatchReady: (content: string) => void;
  private config: BatcherConfig;
  private messageId: string;

  constructor(
    messageId: string, 
    onBatchReady: (content: string) => void,
    config: Partial<BatcherConfig> = {}
  ) {
    this.messageId = messageId;
    this.onBatchReady = onBatchReady;
    this.config = {
      batchWindow: 100,        // Default 100ms windows
      ...config
    };
  }

  /**
   * Add a token to the buffer
   */
  addToken(token: string): void {
    this.buffer += token;
    
    // Schedule flush if not already scheduled
    if (!this.flushTimeout) {
      this.scheduleFlush();
    }
  }

  /**
   * Schedule a flush at the end of the current window
   */
  private scheduleFlush(): void {
    this.flushTimeout = setTimeout(() => {
      this.flush();
    }, this.config.batchWindow);
  }

  /**
   * Flush the current buffer
   */
  flush(): void {
    if (this.buffer.length === 0) return;

    const content = this.buffer;
    this.buffer = '';
    this.flushTimeout = null;
    
    this.onBatchReady(content);
  }

  /**
   * Complete streaming and flush any remaining content
   */
  complete(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    
    if (this.buffer.length > 0) {
      this.flush();
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.buffer = '';
  }
}

/**
 * Batcher manager to handle multiple concurrent streams
 */
export class BatcherManager {
  private batchers = new Map<string, TokenBatcher>();

  getBatcher(
    messageId: string, 
    onBatchReady: (content: string) => void, 
    config?: Partial<BatcherConfig>
  ): TokenBatcher {
    if (!this.batchers.has(messageId)) {
      const batcher = new TokenBatcher(messageId, onBatchReady, config);
      this.batchers.set(messageId, batcher);
    }
    return this.batchers.get(messageId)!;
  }

  removeBatcher(messageId: string): void {
    const batcher = this.batchers.get(messageId);
    if (batcher) {
      batcher.destroy();
      this.batchers.delete(messageId);
    }
  }

  completeStream(messageId: string): void {
    const batcher = this.batchers.get(messageId);
    if (batcher) {
      batcher.complete();
      // Clean up shortly after completion
      setTimeout(() => this.removeBatcher(messageId), 1000);
    }
  }
}

// Global instance
export const batcherManager = new BatcherManager();
