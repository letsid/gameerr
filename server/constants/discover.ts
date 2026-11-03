import type DiscoverSlider from '@server/entity/DiscoverSlider';

export enum DiscoverSliderType {
  RECENTLY_ADDED = 1,
  RECENT_REQUESTS,
  WATCHLIST,
  RECENT_RELEASES,
  UPCOMING,
  ALL_TIME_BEST,
  BEST_OF_YEAR,
  GENRE,
  TRENDING,
}

export const defaultSliders: Partial<DiscoverSlider>[] = [
  {
    type: DiscoverSliderType.RECENT_REQUESTS,
    enabled: true,
    isBuiltIn: true,
    order: 0,
  },
  {
    type: DiscoverSliderType.WATCHLIST,
    enabled: true,
    isBuiltIn: true,
    order: 1,
  },
];
