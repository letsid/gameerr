import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import type { PlatformsResponse } from '@server/interfaces/api/gameInterfaces';
import type { Platform } from '@server/lib/platforms';
import { useMemo } from 'react';
import useSWR from 'swr';

// PC (Microsoft Windows) in IGDB
export const PC_PLATFORM_ID = 6;

/**
 * All platforms known to IGDB, sorted by name
 */
const usePlatforms = () => {
  const { data, error } = useSWR<PlatformsResponse>('/api/v1/platforms', {
    revalidateOnFocus: false,
  });

  const byId = useMemo(
    () =>
      new Map<number, Platform>(
        (data?.results ?? []).map((platform) => [platform.id, platform])
      ),
    [data]
  );

  return {
    platforms: data?.results ?? [],
    byId,
    isLoading: !data && !error,
    error,
  };
};

/**
 * Platforms the signed-in user browses by: their own choice, else the
 * admin default, else PC. Mirrors resolvePlatforms on the server.
 */
export const usePreferredPlatforms = (): number[] => {
  const { user } = useUser();
  const { currentSettings } = useSettings();

  return useMemo(() => {
    const own = user?.settings?.preferredPlatforms ?? [];
    if (own.length > 0) {
      return own;
    }

    const fallback = currentSettings.defaultPlatforms ?? [];
    return fallback.length > 0 ? fallback : [PC_PLATFORM_ID];
  }, [user?.settings?.preferredPlatforms, currentSettings.defaultPlatforms]);
};

export const platformLabel = (
  id: number,
  byId: Map<number, Platform>
): string => {
  const platform = byId.get(id);
  return platform?.abbreviation ?? platform?.name ?? `#${id}`;
};

export default usePlatforms;
