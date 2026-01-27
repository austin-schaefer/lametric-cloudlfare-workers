# Scryfall App

Displays random Magic: The Gathering cards from Scryfall API on LaMetric devices. Updates hourly with new random cards.

## Parameters

| Parameter | Required | Default | Options |
|-----------|----------|---------|---------|
| `cardType` | No | `paper` | `old-school`, `old-border`, `paper`, `any` |
| `currency` | No | `usd` | `usd`, `eur`, `tix`, `none` |

**Card types:**
- `old-school`: Eldraine and earlier cards, no digital/funny cards
- `old-border`: Scourge and earlier cards, no funny cards
- `paper`: Only cards printed in paper
- `any`: Any card including digital

**Currency:**
- `usd`: US Dollars
- `eur`: Euros
- `tix`: MTGO tickets
- `none`: Hide price frame

## Display Format

4 frames (3 if currency is `none` or price unavailable):

1. **Card name** - Mana color icon
2. **Release info** - Set code and rarity (C/U/R/M)
3. **Card type** - Type icon
4. **Price** - Currency icon (optional)

## Data Updates

Scheduled worker fetches all 4 card types hourly at X:00. Each fetch stored separately in KV:

- `app:scryfall:old-school`
- `app:scryfall:old-border`
- `app:scryfall:paper`
- `app:scryfall:any`

Fresh random card on each hourly update (no caching deduplication).

## Testing

**Local:**
```bash
curl "http://localhost:8787/apps/scryfall?cardType=paper&currency=usd"
```

**Production:**
```bash
curl "https://your-worker.workers.dev/apps/scryfall?cardType=old-school&currency=none"
```

## Icons

Icon mappings are placeholders (`i3313`). Update `src/apps/scryfall.ts` to use real LaMetric icon IDs:

- `MANA_ICONS`: 16 entries (5 mono-colors + 10 guilds + colorless)
- `TYPE_ICONS`: 8 card types + default
- `CURRENCY_ICONS`: 3 currencies
- `YEAR_ICONS`: 1993-2030

## Rate Limiting

100ms delay between API requests when fetching 4 card types. Scryfall allows up to 10 req/sec (well within limit).

## LaMetric Configuration

Configure in LaMetric Developer Portal with parameter support:

```
URL to get data from: https://your-worker.workers.dev/apps/scryfall?
Sample params: &cardType=paper&currency=usd

Parameters:
- SINGLE CHOICE: id=cardType, title=Card type, choices=[old-school, old-border, paper, any]
- SINGLE CHOICE: id=currency, title=Currency, choices=[usd, eur, tix, none]
```

URL must end with `?` for validation. App uses defaults when parameters are missing.
