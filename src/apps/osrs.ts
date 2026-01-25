import { Env, LaMetricResponse } from '../types';
import { createFrame, createResponse } from '../utils/lametric';
import { formatLargeNumber } from '../utils/number';

export const name = 'osrs';
export const kvKey = 'app:osrs:characters';

// Skill display order - exactly 24 skills
const SKILL_ORDER = [
  'overall',
  'attack', 'strength', 'defence', 'ranged', 'prayer', 'magic',
  'runecrafting', 'construction', 'hitpoints', 'agility', 'herblore',
  'thieving', 'crafting', 'fletching', 'slayer', 'hunter',
  'mining', 'smithing', 'fishing', 'cooking', 'firemaking',
  'woodcutting', 'farming', 'sailing'
];

// LaMetric icon IDs for each skill (custom created icons)
const SKILL_ICONS: Record<string, string> = {
  overall: 'i72683',
  attack: 'i72681',
  strength: 'i72682',
  defence: 'i72684',
  ranged: 'i72685',
  prayer: 'i72686',
  magic: 'i72687',
  runecrafting: 'i72688',
  construction: 'i72689',
  hitpoints: 'i72690',
  agility: 'i72691',
  herblore: 'i72702',
  thieving: 'i72704',
  crafting: 'i72713',
  fletching: 'i72714',
  slayer: 'i72716',
  hunter: 'i72680',
  mining: 'i72719',
  smithing: 'i72720',
  fishing: 'i72721',
  cooking: 'i72722',
  firemaking: 'i72723',
  woodcutting: 'i72724',
  farming: 'i72725',
  sailing: 'i72726',
};

// WiseOldMan API types
interface WiseOldManSkillGains {
  metric: string;
  experience: {
    gained: number;
    start: number;
    end: number;
  };
  rank: {
    gained: number;
    start: number;
    end: number;
  };
  level: {
    gained: number;
    start: number;
    end: number;
  };
}

interface WiseOldManGainsResponse {
  startsAt: string;
  endsAt: string;
  data: {
    skills: Record<string, WiseOldManSkillGains>;
    bosses: any;
    activities: any;
    computed: any;
  };
}

interface CachedOSRSData {
  username: string;
  period: string;
  lastUpdated: string;
  gains: WiseOldManGainsResponse;
}

// Character registry management
export async function getCharacterRegistry(env: Env): Promise<string[]> {
  const registryData = await env.CLOCK_DATA.get(kvKey);

  if (!registryData) {
    return [];
  }

  try {
    const registry = JSON.parse(registryData);
    return Array.isArray(registry) ? registry : [];
  } catch (error) {
    console.error('Failed to parse character registry:', error);
    return [];
  }
}

export async function addCharacterToRegistry(env: Env, username: string): Promise<void> {
  const registry = await getCharacterRegistry(env);

  // Check if already exists (case-insensitive)
  const normalizedUsername = username.toLowerCase();
  const existingIndex = registry.findIndex(u => u.toLowerCase() === normalizedUsername);

  if (existingIndex === -1) {
    registry.push(username);
    await env.CLOCK_DATA.put(kvKey, JSON.stringify(registry));
    console.log(`Added ${username} to character registry`);
  }
}

// WiseOldMan API integration
async function fetchWiseOldManData(
  username: string,
  period: string
): Promise<WiseOldManGainsResponse> {
  const encodedUsername = encodeURIComponent(username);
  const url = `https://api.wiseoldman.net/v2/players/${encodedUsername}/gained?period=${period}`;

  console.log(`Fetching WiseOldMan data: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'LaMetric-OSRS-Tracker/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`WiseOldMan API returned ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Custom scheduled handler (called by scheduled.ts)
export async function customScheduledHandler(env: Env): Promise<void> {
  console.log('OSRS scheduled handler started');

  const registry = await getCharacterRegistry(env);

  if (registry.length === 0) {
    console.log('No characters registered yet');
    return;
  }

  console.log(`Fetching data for ${registry.length} character(s): ${registry.join(', ')}`);

  const periods = ['day', 'week', 'month'];

  // Process each character
  const results = await Promise.allSettled(
    registry.map(async (username) => {
      // Fetch all periods in parallel for this character
      const periodResults = await Promise.allSettled(
        periods.map(async (period) => {
          try {
            const gains = await fetchWiseOldManData(username, period);

            const cachedData: CachedOSRSData = {
              username,
              period,
              lastUpdated: new Date().toISOString(),
              gains,
            };

            const dataKey = `app:osrs:data:${username}:${period}`;
            await env.CLOCK_DATA.put(dataKey, JSON.stringify(cachedData));

            console.log(`✓ Updated ${username} (${period})`);
            return { username, period, success: true };
          } catch (error) {
            console.error(`✗ Failed to update ${username} (${period}):`, error);
            return { username, period, success: false, error };
          }
        })
      );

      return { username, periodResults };
    })
  );

  // Log summary
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`OSRS scheduled handler completed: ${successful} characters processed, ${failed} failed`);
}

// Format skill gain for display
function formatSkillGain(skillName: string, xpGained: number): string {
  const formattedXP = xpGained > 0 ? `+${formatLargeNumber(xpGained)}` : '+0';
  return `${formattedXP} XP`;
}

// No-op fetchData for compatibility with standard app pattern
export async function fetchData(env: Env): Promise<string[]> {
  return await getCharacterRegistry(env);
}

// Format response - converts WiseOldMan data to LaMetric frames
export function formatResponse(data: any, username?: string, period?: string): LaMetricResponse {
  // If data is a CachedOSRSData object, extract the gains
  let gainsData: WiseOldManGainsResponse;

  if (data && typeof data === 'object' && 'gains' in data) {
    gainsData = (data as CachedOSRSData).gains;
  } else if (data && typeof data === 'object' && 'data' in data) {
    gainsData = data as WiseOldManGainsResponse;
  } else {
    // Fallback if data format is unexpected
    return createResponse([
      createFrame('No data', 'i3313')
    ]);
  }

  const frames = SKILL_ORDER.map((skillName) => {
    const skillData = gainsData.data.skills[skillName];
    const xpGained = skillData?.experience?.gained ?? 0;
    const icon = SKILL_ICONS[skillName] || 'i186';

    return createFrame(formatSkillGain(skillName, xpGained), icon);
  });

  return createResponse(frames);
}
