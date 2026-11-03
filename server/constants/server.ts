export enum MediaServerType {
  PLEX = 1,
  JELLYFIN,
  EMBY,
  NOT_CONFIGURED,
  // Only local accounts, no media server is used for sign-in
  LOCAL,
}

export enum ServerType {
  JELLYFIN = 'Jellyfin',
  EMBY = 'Emby',
}
