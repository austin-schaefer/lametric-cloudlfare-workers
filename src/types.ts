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
  formatResponse: (data: any) => LaMetricResponse;
}

export interface Env {
  CLOCK_DATA: KVNamespace;
  [key: string]: any;
}
