import type { ChartPoint } from './tickHistory';

export type ChartTimeWindow = Readonly<{ start: number; end: number }>;
export const MAX_CHART_ZOOM = 16;

export function chartTimeBounds(
  points: readonly ChartPoint[],
): ChartTimeWindow | undefined {
  if (points.length === 0) return undefined;
  return { start: points[0]!.receivedAt, end: points[points.length - 1]!.receivedAt };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Pinch scale > 1 zooms in around the initial midpoint. Moving that midpoint
 * also moves the window, keeping the original focal time under the fingers. */
export function zoomChartWindow(
  bounds: ChartTimeWindow,
  current: ChartTimeWindow,
  scale: number,
  initialFocus = 0.5,
  currentFocus = initialFocus,
): ChartTimeWindow {
  const totalSpan = bounds.end - bounds.start;
  if (totalSpan <= 0 || !Number.isFinite(scale) || scale <= 0) return bounds;
  const span = clamp(
    (current.end - current.start) / scale,
    totalSpan / MAX_CHART_ZOOM,
    totalSpan,
  );
  const focalTime =
    current.start + clamp(initialFocus, 0, 1) * (current.end - current.start);
  const start = clamp(
    focalTime - clamp(currentFocus, 0, 1) * span,
    bounds.start,
    bounds.end - span,
  );
  return { start, end: start + span };
}

/** Selection searches the raw ticks, not the simplified SVG path. Never
 * interpolate a guessed price between two trades. Ties select the earlier tick. */
export function nearestChartPoint(
  points: readonly ChartPoint[],
  window: ChartTimeWindow,
  fraction: number,
): ChartPoint | undefined {
  const target = window.start + clamp(fraction, 0, 1) * (window.end - window.start);
  let nearest: ChartPoint | undefined;
  let distance = Infinity;
  for (const point of points) {
    if (point.receivedAt < window.start || point.receivedAt > window.end) continue;
    const nextDistance = Math.abs(point.receivedAt - target);
    if (nextDistance < distance) {
      nearest = point;
      distance = nextDistance;
    }
  }
  return nearest;
}

/** Touch positions are measured in screen pixels; SVG uses its own 320-point axis. */
export function chartTouchFraction(localX: number, frameWidth: number): number {
  if (frameWidth <= 0) return 0;
  return clamp(((localX / frameWidth) * 320 - 10) / 300, 0, 1);
}
