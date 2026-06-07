import fs from 'fs';

// Mock Collector interface map
export interface CollectorStatus {
  id: string;
  name: string;
  type: string;
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'WARNING' | 'FAILED';
  lastRun: string;
  itemsProcessed: number;
  errorMessage?: string;
}

export const initialCollectors: CollectorStatus[] = [
  { id: 'col-1', name: 'Federal Reserve API', type: 'central_bank', status: 'SUCCESS', lastRun: new Date().toISOString(), itemsProcessed: 4 },
  { id: 'col-2', name: 'Global Shipping Manifests', type: 'supply_chain', status: 'SUCCESS', lastRun: new Date(Date.now() - 300000).toISOString(), itemsProcessed: 120 },
  { id: 'col-3', name: 'Reuters Market RSS', type: 'rss', status: 'RUNNING', lastRun: new Date().toISOString(), itemsProcessed: 45 },
  { id: 'col-4', name: 'Commodities Socket', type: 'market', status: 'FAILED', lastRun: new Date(Date.now() - 3600000).toISOString(), itemsProcessed: 0, errorMessage: 'Connection timed out' },
  { id: 'col-5', name: 'Dark Web Cyber Threats', type: 'cyber', status: 'IDLE', lastRun: new Date(Date.now() - 86400000).toISOString(), itemsProcessed: 2 }
];
