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
  TOP_PICKS,
}

export const defaultSliders: Partial<DiscoverSlider>[] = [
  {
    type: DiscoverSliderType.TRENDING,
    enabled: true,
    isBuiltIn: true,
    order: 0,
  },
  {
    type: DiscoverSliderType.RECENT_RELEASES,
    enabled: true,
    isBuiltIn: true,
    order: 1,
  },
  {
    type: DiscoverSliderType.UPCOMING,
    enabled: true,
    isBuiltIn: true,
    order: 2,
  },
  {
    type: DiscoverSliderType.ALL_TIME_BEST,
    enabled: true,
    isBuiltIn: true,
    order: 3,
  },
  {
    type: DiscoverSliderType.TOP_PICKS,
    enabled: true,
    isBuiltIn: true,
    order: 4,
  },
  {
    type: DiscoverSliderType.RECENT_REQUESTS,
    enabled: true,
    isBuiltIn: true,
    order: 5,
  },
  {
    type: DiscoverSliderType.WATCHLIST,
    enabled: true,
    isBuiltIn: true,
    order: 6,
  },
];
