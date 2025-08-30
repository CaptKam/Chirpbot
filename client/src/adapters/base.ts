import type { AlertVM, Sport } from "@/lib/alert-vm";

export interface SportAdapter {
  sport: Sport;
  canHandle: (a: any) => boolean;          // a.sport === 'MLB', etc.
  toViewModel: (a: any) => AlertVM;
}

export const adapters: SportAdapter[] = [];

export function toVM(alert: any): AlertVM {
  const ad = adapters.find(x => x.canHandle(alert));
  if (!ad) {
    // Fallback for unknown sports
    return {
      id: alert.id,
      sport: alert.sport as Sport || 'MLB',
      title: alert.title || alert.description || 'Game Alert',
      situation: 'Unknown situation',
      scoreline: 'Score unavailable',
      period: '',
      edge: { label: 'Edge', value: '' },
      priority: alert.priority ?? 70,
      actionLine: alert.description || 'Alert detected',
      tags: [],
      isNew: !alert.seen,
      createdAt: alert.createdAt || alert.created_at,
    };
  }
  return ad.toViewModel(alert);
}