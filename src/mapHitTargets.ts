export interface SvgHitArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getWakeupBubbleHitArea(
  bubbleWidth: number,
  bubbleTop: number,
  bubbleHeight: number,
  padding: number,
): SvgHitArea {
  return {
    x: -bubbleWidth / 2 - padding,
    y: bubbleTop - padding,
    width: bubbleWidth + padding * 2,
    height: bubbleHeight + padding * 2 + 18,
  };
}

export function getMarkerLabelHitArea(label: string, fontSize: number): SvgHitArea {
  const textWidth = Math.max(32, label.length * fontSize * 0.72);
  return {
    x: -(textWidth + 16) / 2,
    y: -fontSize - 18,
    width: textWidth + 16,
    height: fontSize + 16,
  };
}

export function getGreetingBubbleHitArea(
  bubbleWidth: number,
  bubbleHeight: number,
  bubbleYOffset: number,
  padding: number,
): SvgHitArea {
  return {
    x: -bubbleWidth / 2 - padding,
    y: -bubbleHeight - bubbleYOffset - padding,
    width: bubbleWidth + padding * 2,
    height: bubbleHeight + padding * 2 + 10,
  };
}
