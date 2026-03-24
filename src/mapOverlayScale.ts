export interface ViewportSize {
  width: number;
  height: number;
}

export function normalizeViewportSize(
  width: number,
  height: number,
  fallback: ViewportSize = { width: 800, height: 600 },
): ViewportSize {
  if (width <= 0 || height <= 0) {
    return fallback;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function getMapOverlayScale(
  width: number,
  height: number,
  baseWidth = 800,
  baseHeight = 600,
): number {
  if (width <= 0 || height <= 0) {
    return 1;
  }

  const scale = Math.min(width / baseWidth, height / baseHeight);
  return scale > 0 ? scale : 1;
}

export function getStableSvgSize(baseSize: number, overlayScale: number): number {
  if (overlayScale <= 0) {
    return baseSize;
  }

  return baseSize / overlayScale;
}
