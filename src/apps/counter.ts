import { Env, LaMetricResponse } from '../types';
import { createFrame, createResponse } from '../utils/lametric';

export const name = 'counter';
export const kvKey = 'app:counter';

export async function fetchData(env: Env): Promise<number> {
  const currentValue = await env.CLOCK_DATA.get(kvKey);
  const count = currentValue ? parseInt(currentValue, 10) : 0;
  const newCount = count + 1;

  // Note: KV write now handled by scheduled.ts with smart caching
  return newCount;
}

export function formatResponse(count: number): LaMetricResponse {
  const randomIconId = Math.floor(Math.random() * 70000) + 1;
  return createResponse([
    createFrame(`#${count}`, `i${randomIconId}`)
  ]);
}
