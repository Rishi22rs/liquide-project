export type PriceTick = Readonly<{ symbol: string; price: number; receivedAt: number }>;
export type ChartPoint = Readonly<{ price: number; receivedAt: number }>;

/** Each detail screen owns a session. Only received price ticks are recorded:
 * no REST seed, no invented history, and no volume-only updates. */
export function createTickHistory(symbol: string) {
  let points: readonly ChartPoint[] = [];
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => points,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    append(tick: PriceTick) {
      if (
        tick.symbol !== symbol ||
        !Number.isSafeInteger(tick.price) ||
        tick.price < 0 ||
        !Number.isFinite(tick.receivedAt)
      )
        return;
      points = [...points, { price: tick.price, receivedAt: tick.receivedAt }];
      listeners.forEach((listener) => listener());
    },
  };
}

/** Keep the first/last tick and each bucket's actual min/max. Rendering stays
 * bounded while the full session is retained and used for range labels. */
export function sampleChartPoints(
  points: readonly ChartPoint[],
  limit = 240,
): readonly ChartPoint[] {
  if (limit < 4) throw new Error('Chart sample limit must be at least four');
  if (points.length <= limit) return points;
  const sampled: ChartPoint[] = [points[0]!];
  const buckets = Math.floor((limit - 2) / 2);
  const interiorLength = points.length - 2;

  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = 1 + Math.floor((bucket * interiorLength) / buckets);
    const end = 1 + Math.floor(((bucket + 1) * interiorLength) / buckets);
    let minimumIndex = start;
    let maximumIndex = start;
    for (let index = start + 1; index < end; index++) {
      if (points[index]!.price < points[minimumIndex]!.price) minimumIndex = index;
      if (points[index]!.price > points[maximumIndex]!.price) maximumIndex = index;
    }
    for (const index of [...new Set([minimumIndex, maximumIndex])].sort(
      (a, b) => a - b,
    )) {
      sampled.push(points[index]!);
    }
  }
  sampled.push(points[points.length - 1]!);
  return sampled;
}

/** Convert paise/time values into SVG coordinates; constant prices stay centered. */
export function buildTickChart(points: readonly ChartPoint[], width = 320, height = 180) {
  if (points.length === 0) return undefined;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let minimum = first.price;
  let maximum = first.price;
  for (const point of points) {
    minimum = Math.min(minimum, point.price);
    maximum = Math.max(maximum, point.price);
  }
  const sampled = sampleChartPoints(points);
  const padding = 10;
  const duration = last.receivedAt - first.receivedAt;
  const range = maximum - minimum;
  const coordinates = sampled.map((point, index) => ({
    x:
      sampled.length === 1
        ? width / 2
        : padding +
          (duration > 0
            ? (point.receivedAt - first.receivedAt) / duration
            : index / (sampled.length - 1)) *
            (width - 2 * padding),
    y:
      range === 0
        ? height / 2
        : height - padding - ((point.price - minimum) / range) * (height - 2 * padding),
  }));
  const line = coordinates
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
    )
    .join(' ');
  const start = coordinates[0]!;
  const end = coordinates[coordinates.length - 1]!;
  const area = `${line} L${end.x.toFixed(2)},${height} L${start.x.toFixed(2)},${height} Z`;
  return { line, area, end, minimum, maximum, first, last, sampleCount: sampled.length };
}
