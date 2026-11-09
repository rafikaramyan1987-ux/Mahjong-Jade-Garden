import type { Layout } from '../game/layout';
import { JADE_TURTLE } from './classic';

/** All layouts in journey order (more layouts arrive with the full journey). */
export const LAYOUTS: Layout[] = [JADE_TURTLE];

export function layoutById(id: string): Layout {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
