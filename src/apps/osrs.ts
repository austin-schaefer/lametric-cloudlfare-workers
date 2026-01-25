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

  // Load existing cached data for comparison
  const existingDataRaw = await env.CLOCK_DATA.get('app:osrs:alldata');
  const existingData: Record<string, Record<string, CachedOSRSData>> = existingDataRaw
    ? JSON.parse(existingDataRaw)
    : {};

  const aggregatedData: Record<string, Record<string, CachedOSRSData>> = {};
  let hasChanges = false;

  // Process each character
  const results = await Promise.allSettled(
    registry.map(async (username) => {
      aggregatedData[username] = {};

      // Fetch all periods in parallel for this character
      const periodResults = await Promise.allSettled(
        periods.map(async (period) => {
          try {
            const gains = await fetchWiseOldManData(username, period);

            // Compare gains data (not timestamps) to detect actual changes
            const existingPeriodData = existingData[username]?.[period];
            const gainsChanged = !existingPeriodData ||
              JSON.stringify(existingPeriodData.gains) !== JSON.stringify(gains);

            if (gainsChanged) {
              hasChanges = true;
            }

            // Preserve lastUpdated if gains haven't changed, otherwise update it
            const cachedData: CachedOSRSData = {
              username,
              period,
              lastUpdated: gainsChanged
                ? new Date().toISOString()
                : (existingPeriodData?.lastUpdated || new Date().toISOString()),
              gains,
            };

            aggregatedData[username][period] = cachedData;

            const changeStatus = gainsChanged ? '(changed)' : '(unchanged)';
            console.log(`✓ Fetched ${username} (${period}) ${changeStatus}`);
            return { username, period, success: true, changed: gainsChanged };
          } catch (error) {
            console.error(`✗ Failed to fetch ${username} (${period}):`, error);

            // If fetch failed, preserve existing data if available
            if (existingData[username]?.[period]) {
              aggregatedData[username][period] = existingData[username][period];
            }

            return { username, period, success: false, error };
          }
        })
      );

      return { username, periodResults };
    })
  );

  // Smart caching: only write if data actually changed
  if (hasChanges) {
    await env.CLOCK_DATA.put('app:osrs:alldata', JSON.stringify(aggregatedData));
    console.log('✓ Wrote aggregated OSRS data to KV (gains changed)');
  } else {
    console.log('Skipped OSRS KV write (no gains changed)');
  }

  // Log summary
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`OSRS scheduled handler completed: ${successful} characters processed, ${failed} failed`);
}

// Format skill gain for display
function formatSkillGain(skillName: string, xpGained: number): string {
  const formattedXP = xpGained > 0 ? `+${formatLargeNumber(xpGained)}` : '+0';
  return formattedXP;
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
