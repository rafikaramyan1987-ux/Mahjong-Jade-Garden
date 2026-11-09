import type { AdSlot, Platform } from './types';

/** Plain web build (GitHub Pages, self-hosting): no portal SDK and no ads; optional extras are granted for free. */
export class WebPlatform implements Platform {
  readonly name = 'web';
  readonly available = false;
  readonly initBeforeStart = false;
  readonly muted = false;
  onMute: (m: boolean) => void = () => {};
  onAdPause: (paused: boolean) => void = () => {};
  locale() {
    return null;
  }
  loadingStart() {}
  loadingStop() {}
  happytime() {}
  adSlot(_slot: AdSlot) {
    return false;
  }
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
