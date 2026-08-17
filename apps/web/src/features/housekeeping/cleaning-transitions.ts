export type CleaningStatus = 'DIRTY' | 'IN_PROGRESS' | 'INSPECTION' | 'CLEAN';

export const CLEANING_TRANSITIONS: Record<CleaningStatus, CleaningStatus[]> = {
  DIRTY:       ['IN_PROGRESS', 'INSPECTION'],
  IN_PROGRESS: ['INSPECTION'],
  INSPECTION:  ['CLEAN', 'IN_PROGRESS'],
  CLEAN:       ['DIRTY'],
};

export const COLUMN_LABELS: Record<CleaningStatus, string> = {
  DIRTY:       'Pendientes',
  IN_PROGRESS: 'En proceso',
  INSPECTION:  'Listas hoy',
  CLEAN:       'Verificadas',
};

export const PRIORITY_LABELS: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH:   'Alta',
  MEDIUM: 'Media',
  LOW:    'Baja',
};
