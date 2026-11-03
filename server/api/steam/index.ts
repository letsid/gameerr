import ExternalAPI from '@server/api/externalapi';
import type {
  SteamAppData,
  SteamAppDetailsResponse,
} from '@server/api/steam/interfaces';
import cacheManager from '@server/lib/cache';

const STEAM_STORE_URL = 'https://store.steampowered.com';

// The store API is unofficial and limits callers to roughly 200 requests
// per five minutes, so stay well below one request per second
const MAX_RPS = 1;

const APPDETAILS_TTL = 6 * 60 * 60;

class SteamStoreAPI extends ExternalAPI {
  constructor() {
    super(
      STEAM_STORE_URL,
      {},
      {
        nodeCache: cacheManager.getCache('steam').data,
        rateLimit: { maxRPS: MAX_RPS, maxRequests: MAX_RPS },
      }
    );
  }

  /**
   * Store data for one app. Resolves to undefined when Steam does not know
   * the app or does not sell it in the given country.
   */
  public async getAppDetails(
    appId: number,
    countryCode = 'de'
  ): Promise<SteamAppData | undefined> {
    const response = await this.get<SteamAppDetailsResponse>(
      '/api/appdetails',
      { params: { appids: Math.trunc(appId), cc: countryCode, l: 'en' } },
      APPDETAILS_TTL
    );

    const entry = response[String(Math.trunc(appId))];

    return entry?.success ? entry.data : undefined;
  }
}

// One shared instance, so the rate limit applies across every caller
const steam = new SteamStoreAPI();

export default steam;
