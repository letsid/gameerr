// Shapes of IGDB v4 responses, taken from live responses stored in
// server/test/fixtures/igdb. IGDB only returns fields that were requested
// and that have a value, so everything besides the id is optional.

export interface IgdbPlatform {
  id: number;
  name?: string;
  abbreviation?: string;
  alternative_name?: string;
  slug?: string;
  generation?: number;
  platform_family?: number;
  platform_type?: number;
}

export interface IgdbImage {
  id: number;
  image_id?: string;
}

export interface IgdbGenre {
  id: number;
  name?: string;
}

export interface IgdbReleaseDate {
  id: number;
  date?: number;
  platform?: number;
  release_region?: number;
  status?: number;
  game?: number;
}

export interface IgdbExternalGame {
  id: number;
  uid?: string;
  /**
   * See external_game_sources: 1 = Steam, 5 = GOG
   */
  external_game_source?: number;
}

export interface IgdbGame {
  id: number;
  name?: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  /**
   * See game_types: 0 = main game, 8 = remake, 9 = remaster, ...
   */
  game_type?: number;
  platforms?: number[];
  genres?: IgdbGenre[];
  cover?: IgdbImage;
  release_dates?: IgdbReleaseDate[];
  external_games?: IgdbExternalGame[];
  total_rating?: number;
  total_rating_count?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  rating?: number;
  rating_count?: number;
  hypes?: number;
  version_parent?: number;
  parent_game?: number;
}

export interface IgdbPopularityPrimitive {
  id: number;
  game_id?: number;
  popularity_type?: number;
  value?: number;
  calculated_at?: number;
}

export interface IgdbTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export const IGDB_EXTERNAL_SOURCE_STEAM = 1;
export const IGDB_EXTERNAL_SOURCE_GOG = 5;

/**
 * Game types that are a game of their own, as opposed to DLC, bundles,
 * editions or episodes. Keeps lists free of "Game of the Year Edition"
 * duplicates.
 */
export const IGDB_STANDALONE_GAME_TYPES = [0, 8, 9];
