import { toPaise, type Quote } from '../domain/portfolio';
import { SYMBOLS } from './holdings';
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
// Treat network data as unknown until its shape and each field are checked.
export function parseQuotes(payload: unknown): Record<string, Quote> {
  if (
    !isRecord(payload) ||
    payload.status !== 'success' ||
    !isRecord(payload.message) ||
    !Array.isArray(payload.message.data)
  ) {
    throw new Error('The price service returned an invalid response.');
  }
  const quotes: Record<string, Quote> = {};
  for (const item of payload.message.data as unknown[]) {
    if (
      !isRecord(item) ||
      typeof item.symbol !== 'string' ||
      !SYMBOLS.some((s) => s === item.symbol)
    )
      continue;
    const quote: { -readonly [K in keyof Quote]: Quote[K] } = {
      symbol: item.symbol,
      seq: 0,
    };
    for (const field of ['ltp', 'open', 'high', 'low', 'prevClose'] as const) {
      const value = item[field];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
        quote[field] = toPaise(value);
    }
    if (
      typeof item.volume === 'number' &&
      Number.isSafeInteger(item.volume) &&
      item.volume >= 0
    )
      quote.volume = item.volume;
    quotes[item.symbol] = quote;
  }
  return quotes;
}
export async function fetchQuotes(signal?: AbortSignal): Promise<Record<string, Quote>> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.v2.liquide.life/api/markets/ohlc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbols: SYMBOLS }),
      signal: controller.signal,
    });
    // response.ok includes HTTP 201, which this API uses for successful reads.
    if (!response.ok) throw new Error(`Price request failed (${response.status}).`);
    const payload: unknown = await response.json();
    return parseQuotes(payload);
  } finally {
    // Clear the timeout after both successful and failed requests.
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
