export type IgdbImageSize =
  | 'cover_small'
  | 'cover_big'
  | 'screenshot_med'
  | 'screenshot_big'
  | 'screenshot_huge'
  | 'thumb'
  | 'micro'
  | '720p'
  | '1080p';

export const IGDB_IMAGE_HOST = 'https://images.igdb.com';

/**
 * Builds an IGDB image url from an image id.
 * See https://api-docs.igdb.com/#images
 */
export const igdbImageUrl = (
  imageId: string,
  size: IgdbImageSize = 'cover_big'
): string => `${IGDB_IMAGE_HOST}/igdb/image/upload/t_${size}/${imageId}.jpg`;
