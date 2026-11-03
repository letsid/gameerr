import { z } from 'zod';

export const watchlistCreate = z.object({
  igdbId: z.coerce.number(),
  title: z.coerce.string().optional(),
});
