import type { AdSlot, Platform } from './types';

/** Plain web build (GitHub Pages, self-hosting): no portal SDK and no ads; optional extras are granted for free. */
export class WebPlatform implements Platform {
  readonly name = 'web';
  readonly available = false;
  onAdPause: (paused: boolean) => void = () => {};
  async init() {}
  data() {
    return null;
  }
  gameplayStart() {}
  gameplayStop() {}
  async interstitial(_slot: AdSlot) {}
  async rewarded() {
    return true;
  }
}
