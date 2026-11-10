/**
 * The portal platform for this build, chosen at build time: `vite build` = plain web, `--mode gd` (or
 * VITE_PLATFORM=gd) = GameDistribution, `--mode crazygames` = CrazyGames, `--mode gamepix` = GamePix, `--mode playgama` = Playgama (Bridge). `__PLATFORM__` is a literal, so the bundler drops the other implementations.
 */
import { CrazyGamesPlatform } from './platform/crazygames';
import { GamePixPlatform } from './platform/gamepix';
import { GDPlatform } from './platform/gd';
import { PlaygamaPlatform } from './platform/playgama';
import { WebPlatform } from './platform/web';
import type { Platform } from './platform/types';

export type { Platform, AdSlot } from './platform/types';

declare const __PLATFORM__: 'web' | 'gd' | 'crazygames' | 'gamepix' | 'playgama';

export const sdk: Platform =
  __PLATFORM__ === 'gd'
    ? new GDPlatform()
    : __PLATFORM__ === 'crazygames'
      ? new CrazyGamesPlatform()
      : __PLATFORM__ === 'gamepix'
        ? new GamePixPlatform()
        : __PLATFORM__ === 'playgama'
          ? new PlaygamaPlatform()
          : new WebPlatform();
