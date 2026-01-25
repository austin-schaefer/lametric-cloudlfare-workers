import { LaMetricFrame, LaMetricResponse } from '../types';

export function createFrame(text: string, icon?: string): LaMetricFrame {
  const frame: LaMetricFrame = { text: truncateText(text, 50) };
  if (icon) {
    frame.icon = icon;
  }
  return frame;
}

export function createResponse(frames: LaMetricFrame[]): LaMetricResponse {
  return { frames };
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
