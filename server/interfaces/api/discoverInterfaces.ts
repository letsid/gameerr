export interface WatchlistItem {
  id: number;
  igdbId: number;
  mediaType: 'game';
  title: string;
  coverImageId?: string | null;
}

export interface WatchlistResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: WatchlistItem[];
}
