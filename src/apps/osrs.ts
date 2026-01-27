import { Env, LaMetricResponse, LaMetricFrame } from '../types';
import { createFrame, createResponse } from '../utils/lametric';
import { formatLargeNumber } from '../utils/number';

export const name = 'osrs';
export const kvKey = 'app:osrs:characters';

// LaMetric frame limits and rotation configuration
// LaMetric devices have a practical limit of ~15 frames before performance degrades
// To show all 30 stats (username + total XP + 24 skills + 3 additional stats),
// we split them across odd/even minute rotations
const LAMETRIC_FRAME_LIMIT = 15;
const ODD_EVEN_ROTATION_MODULO = 2;

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
  totalXpGained: 'i72749',
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

// Account type icons
const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  regular: 'i72762',
  ironman: 'i72751',
  HCiron: 'i72752',
  UIM: 'i72753',
  GIM: 'i72754',
  HCGIM: 'i72756',
  URGIM: 'i72755',
};

// Additional stat icons
const STAT_ICONS = {
  bossKills: 'i72760',
  clueScrolls: 'i72758',
  rankChange: 'i72761',
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

interface WiseOldManBossEntry {
  metric: string;
  kills: {
    gained: number;
    start: number;
    end: number;
  };
  rank: {
    gained: number;
    start: number;
    end: number;
  };
}

interface WiseOldManActivityScore {
  metric: string;
  score: {
    gained: number;
    start: number;
    end: number;
  };
  rank: {
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
    bosses: Record<string, WiseOldManBossEntry>;
    activities: Record<string, WiseOldManActivityScore>;
    computed: any;
  };
}

interface CachedOSRSData {
  username: string;
  period: string;
  lastUpdated: string;
  gains: WiseOldManGainsResponse;
}

// Helper functions for new stats
function getTotalXP(data: WiseOldManGainsResponse): number {
  return data.data.skills.overall.experience.end;
}

function getTotalLevel(data: WiseOldManGainsResponse): number {
  return data.data.skills.overall.level.end;
}

function getTotalBossKills(data: WiseOldManGainsResponse): number {
  const bosses = data.data.bosses;

  // Defensive check: ensure bosses exists and is an object
  if (!bosses || typeof bosses !== 'object') {
    console.warn('Boss data missing or invalid in API response');
    return 0;
  }

  try {
    return Object.values(bosses)
      .filter((boss): boss is WiseOldManBossEntry => {
        // Type guard: ensure boss has required structure
        return boss !== null &&
               typeof boss === 'object' &&
               'kills' in boss &&
               typeof boss.kills === 'object' &&
               'end' in boss.kills &&
               typeof boss.kills.end === 'number' &&
               boss.kills.end > 0;
      })
      .reduce((sum: number, boss: WiseOldManBossEntry) => sum + boss.kills.end, 0);
  } catch (error) {
    console.error('Error calculating total boss kills:', error);
    return 0;
  }
}

function getTotalClueScrolls(data: WiseOldManGainsResponse): number {
  const activities = data.data.activities;

  // Defensive check: ensure activities exists and is an object
  if (!activities || typeof activities !== 'object') {
    console.warn('Activities data missing or invalid in API response');
    return 0;
  }

  try {
    const clueScrollData = activities.clue_scrolls_all;

    // Check if clue scroll data exists and has the expected structure
    if (!clueScrollData ||
        typeof clueScrollData !== 'object' ||
        !('score' in clueScrollData) ||
        typeof clueScrollData.score !== 'object' ||
        !('end' in clueScrollData.score)) {
      return 0;
    }

    const total = clueScrollData.score.end;
    return typeof total === 'number' ? total : 0;
  } catch (error) {
    console.error('Error calculating total clue scrolls:', error);
    return 0;
  }
}

function getRankChange(data: WiseOldManGainsResponse): number {
  return data.data.skills.overall.rank.gained;
}

function formatRankChange(rankGained: number): string {
  if (rankGained === 0) return '0';
  // Negative = rank improved (went down in number)
  // Display with opposite sign for user clarity
  const displayValue = -rankGained;
  return displayValue > 0 ? `+${formatLargeNumber(displayValue)}` : formatLargeNumber(displayValue);
}

function formatXP(xp: number): string {
  return xp > 0 ? `+${formatLargeNumber(xp)}` : '+0';
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function createTotalLevelFrame(totalLevel: number, accountType: string): LaMetricFrame {
  const icon = ACCOUNT_TYPE_ICONS[accountType] || ACCOUNT_TYPE_ICONS.regular;
  return createFrame(`TL ${totalLevel}`, icon);
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
  period: string,
  env: Env
): Promise<WiseOldManGainsResponse> {
  const encodedUsername = encodeURIComponent(username);
  const url = `https://api.wiseoldman.net/v2/players/${encodedUsername}/gained?period=${period}`;

  console.log(`Fetching WiseOldMan data: ${url}`);

  const headers: Record<string, string> = {
    'User-Agent': 'LaMetric-OSRS-Tracker/1.0',
  };

  // Add API key if available
  if (env.WISEOLDMAN_API_KEY) {
    headers['x-api-key'] = env.WISEOLDMAN_API_KEY;
  }

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`WiseOldMan API returned ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Utility function to hash a string into a number (for rotation group assignment)
function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Assign a character to a rotation group (0-5 for 30-minute rotation cycles)
function getRotationGroup(username: string): number {
  return hashStringToNumber(username.toLowerCase()) % 6;
}

// Add delay between API requests for rate limiting
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Custom scheduled handler (called by scheduled.ts)
export async function customScheduledHandler(env: Env, scheduledTime?: number): Promise<void> {
  console.log('OSRS scheduled handler started');

  const registry = await getCharacterRegistry(env);

  if (registry.length === 0) {
    console.log('No characters registered yet');
    return;
  }

  // Calculate current rotation group (0-5) based on time
  // Each group updates every 30 minutes (6 groups × 5 min = 30 min cycle)
  const currentTime = Date.now();
  const fiveMinuteInterval = Math.floor(currentTime / 300000); // 5-min intervals since epoch
  const currentGroup = fiveMinuteInterval % 6;

  // Filter characters for current rotation group
  const charactersToUpdate = registry.filter(username =>
    getRotationGroup(username) === currentGroup
  );

  console.log(`Total characters: ${registry.length}, Current group: ${currentGroup}, Updating: ${charactersToUpdate.length}`);

  if (charactersToUpdate.length === 0) {
    console.log('No characters assigned to this rotation group');
    return;
  }

  console.log(`Processing characters: ${charactersToUpdate.join(', ')}`);

  const periods = ['day', 'week', 'month'];

  // Load existing cached data for comparison
  const existingDataRaw = await env.CLOCK_DATA.get('app:osrs:alldata');
  const existingData: Record<string, Record<string, CachedOSRSData>> = existingDataRaw
    ? JSON.parse(existingDataRaw)
    : {};

  // Start with existing data, will update only characters in current rotation
  const aggregatedData: Record<string, Record<string, CachedOSRSData>> =
    JSON.parse(JSON.stringify(existingData)); // Deep copy

  let hasChanges = false;
  let requestCount = 0;
  const startTime = Date.now();

  // Process each character SEQUENTIALLY with rate limiting
  for (const username of charactersToUpdate) {
    aggregatedData[username] = aggregatedData[username] || {};

    // Process all periods for this character
    for (const period of periods) {
      try {
        // Rate limiting: 100 req/min = ~600ms per request, use 700ms to be safe
        if (requestCount > 0) {
          await sleep(700);
        }

        const gains = await fetchWiseOldManData(username, period, env);
        requestCount++;

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
      } catch (error) {
        console.error(`✗ Failed to fetch ${username} (${period}):`, error);

        // If fetch failed, preserve existing data if available
        if (existingData[username]?.[period]) {
          aggregatedData[username][period] = existingData[username][period];
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Processed ${requestCount} API requests in ${elapsed}s`);

  // Smart caching: only write if data actually changed
  if (hasChanges) {
    await env.CLOCK_DATA.put('app:osrs:alldata', JSON.stringify(aggregatedData));
    console.log('✓ Wrote aggregated OSRS data to KV (gains changed)');
  } else {
    console.log('Skipped OSRS KV write (no gains changed)');
  }

  console.log(`OSRS scheduled handler completed: ${charactersToUpdate.length} characters processed in rotation group ${currentGroup}`);
}

// Format all stats mode with odd/even minute rotation
// Splits 30 total frames across two rotations to stay within LaMetric's ~15 frame limit
function formatAllStats(
  data: WiseOldManGainsResponse,
  username: string,
  accountType: string
): LaMetricResponse {
  const currentMinute = new Date().getMinutes();
  const isOddMinute = currentMinute % ODD_EVEN_ROTATION_MODULO === 1;

  if (isOddMinute) {
    // ========================================
    // ODD MINUTES: Group A (15 frames)
    // ========================================
    // Frame 1: Total Level + Account Type Icon
    // Frame 2: Total XP (current, not gained)
    // Frame 3: Total XP Gained
    // Frames 4-15: Combat & Support Skills (Attack through Thieving)
    return createResponse([
      // User identification
      createTotalLevelFrame(getTotalLevel(data), accountType),

      // Overall stats
      createFrame(formatLargeNumber(getTotalXP(data)), SKILL_ICONS.overall),
      createFrame(formatXP(data.data.skills.overall.experience.gained), SKILL_ICONS.totalXpGained),

      // Combat skills (Attack, Strength, Defence, Ranged, Prayer, Magic)
      createFrame(formatXP(data.data.skills.attack.experience.gained), SKILL_ICONS.attack),
      createFrame(formatXP(data.data.skills.strength.experience.gained), SKILL_ICONS.strength),
      createFrame(formatXP(data.data.skills.defence.experience.gained), SKILL_ICONS.defence),
      createFrame(formatXP(data.data.skills.ranged.experience.gained), SKILL_ICONS.ranged),
      createFrame(formatXP(data.data.skills.prayer.experience.gained), SKILL_ICONS.prayer),
      createFrame(formatXP(data.data.skills.magic.experience.gained), SKILL_ICONS.magic),

      // Support skills (Runecrafting, Construction, Hitpoints, Agility, Herblore, Thieving)
      createFrame(formatXP(data.data.skills.runecrafting.experience.gained), SKILL_ICONS.runecrafting),
      createFrame(formatXP(data.data.skills.construction.experience.gained), SKILL_ICONS.construction),
      createFrame(formatXP(data.data.skills.hitpoints.experience.gained), SKILL_ICONS.hitpoints),
      createFrame(formatXP(data.data.skills.agility.experience.gained), SKILL_ICONS.agility),
      createFrame(formatXP(data.data.skills.herblore.experience.gained), SKILL_ICONS.herblore),
      createFrame(formatXP(data.data.skills.thieving.experience.gained), SKILL_ICONS.thieving),
    ]);
  } else {
    // ========================================
    // EVEN MINUTES: Group B (15 frames)
    // ========================================
    // Frames 1-12: Artisan & Gathering Skills (Crafting through Sailing)
    // Frames 13-15: Additional Stats (Boss Kills, Clue Scrolls, Rank Change)
    return createResponse([
      // Artisan skills (Crafting, Fletching, Slayer, Hunter)
      createFrame(formatXP(data.data.skills.crafting.experience.gained), SKILL_ICONS.crafting),
      createFrame(formatXP(data.data.skills.fletching.experience.gained), SKILL_ICONS.fletching),
      createFrame(formatXP(data.data.skills.slayer.experience.gained), SKILL_ICONS.slayer),
      createFrame(formatXP(data.data.skills.hunter.experience.gained), SKILL_ICONS.hunter),

      // Gathering skills (Mining, Smithing, Fishing, Cooking, Firemaking, Woodcutting, Farming, Sailing)
      createFrame(formatXP(data.data.skills.mining.experience.gained), SKILL_ICONS.mining),
      createFrame(formatXP(data.data.skills.smithing.experience.gained), SKILL_ICONS.smithing),
      createFrame(formatXP(data.data.skills.fishing.experience.gained), SKILL_ICONS.fishing),
      createFrame(formatXP(data.data.skills.cooking.experience.gained), SKILL_ICONS.cooking),
      createFrame(formatXP(data.data.skills.firemaking.experience.gained), SKILL_ICONS.firemaking),
      createFrame(formatXP(data.data.skills.woodcutting.experience.gained), SKILL_ICONS.woodcutting),
      createFrame(formatXP(data.data.skills.farming.experience.gained), SKILL_ICONS.farming),
      createFrame(formatXP(data.data.skills.sailing.experience.gained), SKILL_ICONS.sailing),

      // Additional stats (PvM/PvE content)
      createFrame(formatLargeNumber(getTotalBossKills(data)), STAT_ICONS.bossKills),
      createFrame(formatLargeNumber(getTotalClueScrolls(data)), STAT_ICONS.clueScrolls),
      createFrame(formatRankChange(getRankChange(data)), STAT_ICONS.rankChange),
    ]);
  }
}

// Format top N XP gains mode (consolidated helper)
function formatTopN(data: WiseOldManGainsResponse, count: number): LaMetricResponse {
  const skills = Object.entries(data.data.skills)
    .filter(([name]) => name !== 'overall')
    .map(([name, skill]) => ({ name, gained: skill.experience.gained }))
    .sort((a, b) => b.gained - a.gained)
    .slice(0, count);

  const frames = [
    createFrame(formatXP(data.data.skills.overall.experience.gained), SKILL_ICONS.totalXpGained),
    ...skills.map(skill =>
      createFrame(formatXP(skill.gained), SKILL_ICONS[skill.name])
    ),
  ];

  return createResponse(frames);
}

// Format top 5 XP gains mode
function formatTop5(data: WiseOldManGainsResponse): LaMetricResponse {
  return formatTopN(data, 5);
}

// Format top 10 XP gains mode
function formatTop10(data: WiseOldManGainsResponse): LaMetricResponse {
  return formatTopN(data, 10);
}

// No-op fetchData for compatibility with standard app pattern
export async function fetchData(env: Env): Promise<string[]> {
  return await getCharacterRegistry(env);
}

// Format response - converts WiseOldMan data to LaMetric frames
export function formatResponse(
  data: any,
  username?: string,
  period?: string,
  mode?: string,
  accountType?: string
): LaMetricResponse {
  // Validate and extract gains data with proper error logging
  let gainsData: WiseOldManGainsResponse;

  if (!data) {
    console.error('formatResponse: No data provided', {
      username,
      period,
      mode,
      accountType,
    });
    return createResponse([
      createFrame('No data', 'i3313')
    ]);
  }

  if (typeof data !== 'object') {
    console.error('formatResponse: Data is not an object', {
      username,
      period,
      mode,
      accountType,
      dataType: typeof data,
    });
    return createResponse([
      createFrame('Invalid data', 'i3313')
    ]);
  }

  // Extract gains data from either cached format or direct API response
  if ('gains' in data) {
    gainsData = (data as CachedOSRSData).gains;
  } else if ('data' in data) {
    gainsData = data as WiseOldManGainsResponse;
  } else {
    console.error('formatResponse: Data format unrecognized', {
      username,
      period,
      mode,
      accountType,
      dataKeys: Object.keys(data),
    });
    return createResponse([
      createFrame('Invalid format', 'i3313')
    ]);
  }

  // Validate gainsData structure
  if (!gainsData.data || !gainsData.data.skills) {
    console.error('formatResponse: Missing required data structure', {
      username,
      period,
      mode,
      accountType,
      hasData: !!gainsData.data,
      hasSkills: !!(gainsData.data && gainsData.data.skills),
    });
    return createResponse([
      createFrame('Incomplete data', 'i3313')
    ]);
  }

  // Default values
  const displayMode = mode || 'allstats';
  const displayAccountType = accountType || 'regular';

  try {
    // Route to appropriate formatter based on mode
    switch (displayMode) {
      case 'top5':
        return formatTop5(gainsData);
      case 'top10':
        return formatTop10(gainsData);
      case 'allstats':
      default:
        return formatAllStats(gainsData, username || 'Player', displayAccountType);
    }
  } catch (error) {
    console.error('formatResponse: Error formatting data', {
      username,
      period,
      mode,
      accountType,
      error: error instanceof Error ? error.message : String(error),
    });
    return createResponse([
      createFrame('Format error', 'i3313')
    ]);
  }
}
