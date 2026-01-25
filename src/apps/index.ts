import { AppConfig } from '../types';
import * as counter from './counter';

export const apps: AppConfig[] = [
  {
    name: counter.name,
    kvKey: counter.kvKey,
    fetchData: counter.fetchData,
    formatResponse: counter.formatResponse,
  },
];

export function getAppByName(name: string): AppConfig | undefined {
  return apps.find(app => app.name === name);
}
