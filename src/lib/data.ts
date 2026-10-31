import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Draw } from './format';

export interface Meta {
  firstCode: string;
  lastCode: string;
  lastDate: string;
  total: number;
  updatedAt: string;
}

export interface Health {
  status: 'ok' | 'error';
  lastRunAt: string;
  lastSuccessAt?: string;
  message?: string;
}

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), 'data', name), 'utf8')) as T;

export const loadDraws = (): Draw[] => read<Draw[]>('draws.json');
export const loadMeta = (): Meta => read<Meta>('meta.json');
export const loadHealth = (): Health | null => {
  try {
    return read<Health>('health.json');
  } catch {
    return null;
  }
};
