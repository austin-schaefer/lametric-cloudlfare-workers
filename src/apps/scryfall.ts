import { Env, LaMetricResponse, LaMetricFrame } from '../types';
import { createFrame, createResponse } from '../utils/lametric';

// TODO: Update these placeholder icons with real LaMetric icon IDs
// Mana Symbols - Based on colors (16 total: 5 mono + 10 guilds + 1 colorless)
const MANA_ICONS: Record<string, string> = {
  // Mono-color
  W: 'i30983',        // TODO: White mana icon
  U: 'i30983',        // TODO: Blue mana icon
  B: 'i30983',        // TODO: Black mana icon
  R: 'i30983',        // TODO: Red mana icon
  G: 'i30983',        // TODO: Green mana icon

  // Two-color guilds (Ravnica guild pairs)
  WU: 'i30983',       // TODO: Azorius (White-Blue) icon
  WB: 'i30983',       // TODO: Orzhov (White-Black) icon
  WR: 'i30983',       // TODO: Boros (White-Red) icon
  WG: 'i30983',       // TODO: Selesnya (White-Green) icon
  UB: 'i30983',       // TODO: Dimir (Blue-Black) icon
  UR: 'i30983',       // TODO: Izzet (Blue-Red) icon
  UG: 'i30983',       // TODO: Simic (Blue-Green) icon
  BR: 'i30983',       // TODO: Rakdos (Black-Red) icon
  BG: 'i30983',       // TODO: Golgari (Black-Green) icon
  RG: 'i30983',       // TODO: Gruul (Red-Green) icon

  // Colorless and multicolor fallback
  colorless: 'i30983', // TODO: Colorless mana icon
  multicolor: 'i30983' // TODO: 3+ color multicolor icon (fallback)
};

// Card Type Icons
const TYPE_ICONS: Record<string, string> = {
  Creature: 'i30983',      // TODO: Creature icon
  Instant: 'i30983',       // TODO: Instant icon
  Sorcery: 'i30983',       // TODO: Sorcery icon
  Artifact: 'i30983',      // TODO: Artifact icon
  Enchantment: 'i30983',   // TODO: Enchantment icon
  Planeswalker: 'i30983',  // TODO: Planeswalker icon
  Land: 'i30983',          // TODO: Land icon
  Battle: 'i30983',        // TODO: Battle icon
  default: 'i30983'        // TODO: Generic card icon
};

// Currency Icons
const CURRENCY_ICONS: Record<string, string> = {
  usd: 'i30983',  // TODO: USD dollar sign icon
  eur: 'i30983',  // TODO: EUR euro sign icon
  tix: 'i30983'   // TODO: TIX ticket icon
};

// Year Icons - one per year from MTG release (1993) through 2030
// TODO: Update these placeholder icons with real LaMetric icon IDs
const YEAR_ICONS: Record<string, string> = {
  '1993': 'i30983', '1994': 'i30983', '1995': 'i30983', '1996': 'i30983', '1997': 'i30983',
  '1998': 'i30983', '1999': 'i30983', '2000': 'i30983', '2001': 'i30983', '2002': 'i30983',
  '2003': 'i30983', '2004': 'i30983', '2005': 'i30983', '2006': 'i30983', '2007': 'i30983',
  '2008': 'i30983', '2009': 'i30983', '2010': 'i30983', '2011': 'i30983', '2012': 'i30983',
  '2013': 'i30983', '2014': 'i30983', '2015': 'i30983', '2016': 'i30983', '2017': 'i30983',
  '2018': 'i30983', '2019': 'i30983', '2020': 'i30983', '2021': 'i30983', '2022': 'i30983',
  '2023': 'i30983', '2024': 'i30983', '2025': 'i30983', '2026': 'i30983', '2027': 'i30983',
  '2028': 'i30983', '2029': 'i30983', '2030': 'i30983'
};

// Card Type URL Mapping
const CARD_TYPE_URLS: Record<string, string> = {
  'old-school': 'https://api.scryfall.com/cards/random?q=-is%3Adigital+-is%3Afunny+date%3C%3Deld',
  'old-border': 'https://api.scryfall.com/cards/random?q=date%3C%3Dscg',
  'paper': 'https://api.scryfall.com/cards/random?q=-is%3Adigital+-is%3Afunny',
  'any': 'https://api.scryfall.com/cards/random'
};

export const VALID_CARD_TYPES = Object.keys(CARD_TYPE_URLS);

// Type Definitions
interface ScryfallCard {
  name: string;
  mana_cost: string;         // "{3}{R}{R}" or "{1}{W/U}{W/U}"
  colors: string[];          // ["R", "G"] or [] for colorless
  released_at: string;       // "1993-08-05"
  set: string;               // "LEA"
  rarity: string;            // "common", "uncommon", "rare", "mythic"
  type_line: string;         // "Legendary Creature — Dragon"
  prices: {
    usd: string | null;
    eur: string | null;
    tix: string | null;
  };
}

interface CachedScryfallData {
  card: ScryfallCard;
  fetchedAt: number;
}

interface AllCardsData {
  'old-school': CachedScryfallData;
  'old-border': CachedScryfallData;
  'paper': CachedScryfallData;
  'any': CachedScryfallData;
}

// Helper Functions
function getYearIcon(year: string): string {
  return YEAR_ICONS[year] || 'i30983';  // Fallback for years outside range
}

function getColorIcon(colors: string[]): string {
  if (colors.length === 0) return MANA_ICONS.colorless;
  if (colors.length === 1) {
    const color = colors[0];
    return MANA_ICONS[color] || MANA_ICONS.colorless;
  }
  if (colors.length === 2) {
    // Sort colors in WUBRG order for consistent guild pairing
    const sortedColors = colors.sort((a, b) => {
      const order = 'WUBRG';
      return order.indexOf(a) - order.indexOf(b);
    }).join('');
    return MANA_ICONS[sortedColors] || MANA_ICONS.multicolor;
  }
  // 3+ colors
  return MANA_ICONS.multicolor;
}

function parseCardType(typeLine: string): string {
  // "Legendary Creature — Dragon" → "Creature"
  // "Artifact Creature — Golem" → "Artifact Creature"
  // "Enchantment Creature — Nymph" → "Enchantment Creature"
  // "Instant" → "Instant"
  const beforeDash = typeLine.split('—')[0].trim();
  const words = beforeDash.split(' ');

  // Check for compound types first
  const compoundTypes = [
    'Artifact Creature',
    'Enchantment Creature',
    'Artifact Land',
    'Enchantment Land'
  ];

  for (const compoundType of compoundTypes) {
    if (beforeDash.includes(compoundType)) {
      return compoundType;
    }
  }

  // Find primary type
  const typeKeywords = ['Creature', 'Instant', 'Sorcery', 'Artifact',
                        'Enchantment', 'Planeswalker', 'Land', 'Battle'];
  for (const word of words) {
    if (typeKeywords.includes(word)) return word;
  }
  return 'Card';  // fallback
}

function abbreviateType(cardType: string): string {
  // Abbreviate type names to fit LaMetric display
  const abbreviations: Record<string, string> = {
    'Artifact Creature': 'ART.CRE.',
    'Enchantment Creature': 'ENC.CRE.',
    'Creature': 'CREAT.',
    'Enchantment': 'ENCHANT.',
    'Planeswalker': 'PLANESW.',
    'Artifact': 'ARTIFACT',  // Already short enough
    'Instant': 'INSTANT',    // Already short enough
    'Sorcery': 'SORCERY',    // Already short enough
    'Land': 'LAND',          // Already short enough
    'Battle': 'BATTLE'       // Already short enough
  };

  return abbreviations[cardType] || cardType;
}

function formatManaCost(manaCost: string): string {
  // Convert Scryfall mana cost format to display format
  // Examples:
  //   "{3}{R}{R}" → "3RR"
  //   "{2}{W}{U}{B}{R}{G}" → "2WUBRG"
  //   "{1}{W/U}{W/U}" → "1{W/U}{W/U}"
  //   "{3}{U/P}" → "3{U/P}"
  //   "{X}{2}{R}" → "X2R"

  if (!manaCost) return '';

  // Match all mana symbols in braces
  const symbols = manaCost.match(/\{[^}]+\}/g) || [];

  return symbols.map(symbol => {
    const content = symbol.slice(1, -1); // Remove braces

    // Keep braces for hybrid and phyrexian mana (contains /)
    if (content.includes('/')) {
      return symbol; // Keep original with braces
    }

    // Remove braces for simple mana (numbers, single letters)
    return content;
  }).join('');
}

function getTypeIcon(cardType: string): string {
  return TYPE_ICONS[cardType] || TYPE_ICONS.default;
}

function parseYear(releasedAt: string): string {
  // "1993-08-05" → "1993"
  return releasedAt.split('-')[0];
}

function formatRarity(rarity: string): string {
  const rarityMap: Record<string, string> = {
    common: 'C',
    uncommon: 'U',
    rare: 'R',
    mythic: 'M',
    bonus: 'B'
  };
  return rarityMap[rarity] || 'C';
}

function formatPrice(price: string | null, currency: string): string {
  if (!price) return '';

  const numPrice = parseFloat(price);
  const currencySymbols: Record<string, string> = {
    usd: '$',
    eur: '€',
    tix: ''  // tix doesn't use a symbol
  };

  const symbol = currencySymbols[currency] || '$';
  const suffix = currency === 'tix' ? ' tix' : '';

  return `${symbol}${numPrice.toFixed(2)}${suffix}`;
}

async function fetchScryfallCard(url: string): Promise<ScryfallCard> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'LaMetric-Scryfall/1.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Scryfall API error: ${response.status}`);
  }

  return await response.json();
}

// Core Exports
export const name = 'scryfall';
export const kvKey = 'app:scryfall:allcards';  // Aggregated storage for all card types

export async function fetchData(env: Env): Promise<CachedScryfallData> {
  // Default implementation - fetches 'paper' card type
  const card = await fetchScryfallCard(CARD_TYPE_URLS.paper);
  return {
    card,
    fetchedAt: Date.now()
  };
}

export async function customScheduledHandler(env: Env, scheduledTime?: number): Promise<void> {
  // Throttle to every 30 minutes at X:00 and X:30 (skipped when scheduledTime is undefined, e.g., test endpoints)
  if (scheduledTime) {
    const currentTime = new Date(scheduledTime);
    const minutes = currentTime.getMinutes();
    const isHalfHour = minutes === 0 || minutes === 30;
    if (!isHalfHour) {
      console.log('Skipping scryfall update (not X:00 or X:30)');
      return;
    }
  }

  // Fetch all 4 card types and aggregate into single KV entry
  const allCards: Partial<AllCardsData> = {};

  for (let i = 0; i < VALID_CARD_TYPES.length; i++) {
    const cardType = VALID_CARD_TYPES[i] as keyof AllCardsData;

    try {
      const card = await fetchScryfallCard(CARD_TYPE_URLS[cardType]);
      const data: CachedScryfallData = {
        card,
        fetchedAt: Date.now()
      };

      allCards[cardType] = data;
      console.log(`Fetched scryfall card for ${cardType}`);
    } catch (error) {
      console.error(`Failed to fetch scryfall ${cardType}:`, error);
      // Try to preserve existing data for this card type
      const existingData = await env.CLOCK_DATA.get(kvKey);
      if (existingData) {
        const existingAllCards = JSON.parse(existingData) as AllCardsData;
        if (existingAllCards[cardType]) {
          allCards[cardType] = existingAllCards[cardType];
          console.log(`Preserved existing data for ${cardType}`);
        }
      }
    }

    // Rate limiting: 100ms delay between requests (except after last one)
    if (i < VALID_CARD_TYPES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Write all cards to single aggregated KV entry
  if (Object.keys(allCards).length > 0) {
    await env.CLOCK_DATA.put(kvKey, JSON.stringify(allCards));
    console.log(`Updated scryfall aggregated data with ${Object.keys(allCards).length} card types`);
  }
}

export function formatResponse(
  data: CachedScryfallData,
  cardType?: string,
  currency?: string
): LaMetricResponse {
  const curr = currency || 'usd';
  const { card } = data;

  const frames: LaMetricFrame[] = [];
  const colorIcon = getColorIcon(card.colors);
  const primaryType = parseCardType(card.type_line);
  const isLand = primaryType === 'Land' || primaryType.includes('Land');

  // Frame 1: Card name
  frames.push(createFrame(card.name, colorIcon));

  // Frame 2: Casting cost (skip for lands)
  if (!isLand) {
    const manaCost = formatManaCost(card.mana_cost);
    if (manaCost) {
      frames.push(createFrame(manaCost, colorIcon));
    }
  }

  // Frame 3: Card type
  const abbreviatedType = abbreviateType(primaryType);
  const typeIcon = getTypeIcon(primaryType);
  frames.push(createFrame(abbreviatedType, typeIcon));

  // Frame 4: Set + rarity
  const year = parseYear(card.released_at);
  const rarityAbbr = formatRarity(card.rarity);
  const yearIcon = getYearIcon(year);
  frames.push(createFrame(`${card.set}|${rarityAbbr}`, yearIcon));

  // Frame 5: Price (skip if currency is 'none' or price is null/missing)
  if (curr !== 'none') {
    const priceValue = card.prices[curr as keyof typeof card.prices];
    if (priceValue !== null) {
      const formattedPrice = formatPrice(priceValue, curr);
      const currencyIcon = CURRENCY_ICONS[curr] || CURRENCY_ICONS.usd;
      frames.push(createFrame(formattedPrice, currencyIcon));
    }
  }

  // Frame 6: Card name again (bookend)
  frames.push(createFrame(card.name, colorIcon));

  return createResponse(frames);
}
