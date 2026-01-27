import { AppConfig, Env } from '../types';
import * as counter from './counter';
import * as osrs from './osrs';
import * as scryfall from './scryfall';

const allApps: AppConfig[] = [
  {
    name: counter.name,
    kvKey: counter.kvKey,
    fetchData: counter.fetchData,
    formatResponse: counter.formatResponse,
  },
  {
    name: osrs.name,
    kvKey: osrs.kvKey,
    fetchData: osrs.fetchData,
    formatResponse: osrs.formatResponse,
    customScheduledHandler: osrs.customScheduledHandler,
  },
  {
    name: scryfall.name,
    kvKey: scryfall.kvKey,
    fetchData: scryfall.fetchData,
    formatResponse: scryfall.formatResponse,
    customScheduledHandler: scryfall.customScheduledHandler,
  },
];

export function getEnabledApps(env: Env): AppConfig[] {
  if (!env.ENABLED_APPS) {
    return allApps;
  }

  const enabledNames = env.ENABLED_APPS.split(',').map(name => name.trim()).filter(name => name);
  const registeredNames = allApps.map(app => app.name);

  // Validate configured app names
  const invalidNames = enabledNames.filter(name => !registeredNames.includes(name));
  if (invalidNames.length > 0) {
    console.warn(
      `Invalid app names in ENABLED_APPS: ${invalidNames.join(', ')}. ` +
      `Valid apps: ${registeredNames.join(', ')}`
    );
  }

  const enabledApps = allApps.filter(app => enabledNames.includes(app.name));

  // Log disabled apps for debugging
  const disabledApps = allApps.filter(app => !enabledNames.includes(app.name));
  if (disabledApps.length > 0) {
    console.log(`Disabled apps: ${disabledApps.map(app => app.name).join(', ')}`);
  }

  return enabledApps;
}

export function getAppByName(name: string, env: Env): AppConfig | undefined {
  const enabledApps = getEnabledApps(env);
  return enabledApps.find(app => app.name === name);
}
