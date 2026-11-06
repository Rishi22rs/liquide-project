export type RipplePoint = Readonly<{ x: number; y: number }>;

/** The reveal must reach the furthest corner even when its origin is near an
 * edge. All measurements use the same logical-pixel coordinate space. */
export function rippleGeometry(origin: RipplePoint, width: number, height: number) {
  const x = Math.max(0, Math.min(width, origin.x));
  const y = Math.max(0, Math.min(height, origin.y));
  return {
    x,
    y,
    radius: Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 2,
  };
}
