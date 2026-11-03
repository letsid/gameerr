// Shapes of the unofficial Steam store API, taken from live responses
// stored in server/test/fixtures/steam. Only the fields Gameerr reads are
// typed. Every field may be missing, Steam omits what an app does not have.

export interface SteamMetacritic {
  score?: number;
  url?: string;
}

export interface SteamPriceOverview {
  currency?: string;
  // Prices are in cents
  initial?: number;
  final?: number;
  discount_percent?: number;
  final_formatted?: string;
}

export interface SteamAppData {
  type?: string;
  name?: string;
  steam_appid?: number;
  is_free?: boolean;
  metacritic?: SteamMetacritic;
  price_overview?: SteamPriceOverview;
  recommendations?: { total?: number };
}

/**
 * appdetails answers with an object keyed by the requested app id
 */
export type SteamAppDetailsResponse = Record<
  string,
  { success: boolean; data?: SteamAppData }
>;
