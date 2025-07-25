import { SimpleCache } from './cache';

// 2 horas
export const cache = new SimpleCache(2 * 60 * 60 * 1000);
