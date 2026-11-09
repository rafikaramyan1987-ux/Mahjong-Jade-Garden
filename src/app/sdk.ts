/**
 * The portal platform for this build, chosen at build time: `vite build` = plain web, `--mode gd` (or
 * VITE_PLATFORM=gd) = GameDistribution. `__PLATFORM__` is a literal, so the bundler drops the other implementations.
 */
import { GDPlatform } from './platform/gd';
import { WebPlatform } from './platform/web';
import type { Platform } from './platform/types';

export type { Platform, AdSlot } from './platform/types';

declare const __PLATFORM__: 'web' | 'gd';

export const sdk: Platform = __PLATFORM__ === 'gd' ? new GDPlatform() : new WebPlatform();
