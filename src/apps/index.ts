import { AppConfig } from '../types';
import * as counter from './counter';
import * as osrs from './osrs';

export const apps: AppConfig[] = [
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
];

export function getAppByName(name: string): AppConfig | undefined {
  return apps.find(app => app.name === name);
}
