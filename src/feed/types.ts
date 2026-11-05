import type { Tick } from '../domain/portfolio';

// Screens and state rely on this contract, not on how ticks are produced.
export interface PriceFeed {
  connect(): void;
  disconnect(): void;
  onDisconnect(handler: () => void): () => void;
  onTick(handler: (tick: Tick) => void): () => void;
}
