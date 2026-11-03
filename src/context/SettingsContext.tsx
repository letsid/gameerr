import { MediaServerType } from '@server/constants/server';
import type { PublicSettingsResponse } from '@server/interfaces/api/settingsInterfaces';
import React from 'react';
import useSWR from 'swr';

export interface SettingsContextProps {
  currentSettings: PublicSettingsResponse;
  children?: React.ReactNode;
}

const defaultSettings = {
  initialized: false,
  applicationTitle: 'Gameerr',
  applicationUrl: '',
  hideAvailable: false,
  hideBlocklisted: false,
  hideRequested: false,
  localLogin: true,
  mediaServerLogin: true,
  mediaServerType: MediaServerType.NOT_CONFIGURED,
  cacheImages: false,
  vapidPublic: '',
  enablePushRegistration: false,
  locale: 'en',
  emailEnabled: false,
  newPlexLogin: true,
  versionCheck: true,
  plexClientIdentifier: '',
  // PC (Microsoft Windows)
  defaultPlatforms: [6],
  metadataConfigured: false,
};

export const SettingsContext = React.createContext<SettingsContextProps>({
  currentSettings: defaultSettings,
});

export const SettingsProvider = ({
  children,
  currentSettings,
}: SettingsContextProps) => {
  const { data, error } = useSWR<PublicSettingsResponse>(
    '/api/v1/settings/public',
    { fallbackData: currentSettings }
  );

  let newSettings = defaultSettings;

  if (data && !error) {
    newSettings = data;
  }

  return (
    <SettingsContext.Provider value={{ currentSettings: newSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
