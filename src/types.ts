export interface LaMetricFrame {
  text: string;
  icon?: string;
  goalData?: {
    start: number;
    current: number;
    end: number;
    unit?: string;
  };
  chartData?: number[];
}

export interface LaMetricResponse {
  frames: LaMetricFrame[];
}

export interface AppConfig {
  name: string;
  kvKey: string;
  fetchData: (env: Env) => Promise<any>;
  formatResponse: (data: any, ...args: any[]) => LaMetricResponse;
  customScheduledHandler?: (env: Env, scheduledTime?: number) => Promise<void>;
}

export interface Env {
  CLOCK_DATA: KVNamespace;
  WISEOLDMAN_API_KEY?: string;
  FMP_API_KEY?: string;
  ENABLED_APPS?: string;
  [key: string]: any;
}
