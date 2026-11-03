import ExternalAPI from '@server/api/externalapi';
import type { PlexSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';

interface PlexStatusResponse {
  MediaContainer: {
    machineIdentifier: string;
    friendlyName: string;
  };
}

/**
 * Minimal Plex Media Server client. Gameerr only needs it to verify the
 * configured server (used for Plex sign-in), library scanning was removed.
 */
class PlexAPI extends ExternalAPI {
  constructor({
    plexToken,
    plexSettings,
    timeout,
  }: {
    plexToken?: string | null;
    plexSettings?: PlexSettings;
    timeout?: number;
  }) {
    const settings = getSettings();
    const settingsPlex = plexSettings ?? settings.plex;
    const protocol = settingsPlex.useSsl ? 'https' : 'http';
    const baseUrl = `${protocol}://${settingsPlex.ip}:${settingsPlex.port}`;

    super(
      baseUrl,
      {},
      {
        timeout,
        headers: {
          'X-Plex-Token': plexToken ?? '',
          'X-Plex-Client-Identifier': settings.clientId,
          'X-Plex-Product': 'Gameerr',
          'X-Plex-Device-Name': 'Gameerr',
          'X-Plex-Platform': 'Gameerr',
        },
      }
    );
  }

  public async getStatus(): Promise<PlexStatusResponse> {
    return await this.get('/');
  }
}

export default PlexAPI;
