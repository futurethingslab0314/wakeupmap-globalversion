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
