import { Router } from 'express';

const searchRoutes = Router();

// Game search is backed by IGDB, which is wired up in the metadata layer.
// Until a metadata provider is configured the search returns no results.
searchRoutes.get('/', async (req, res) => {
  return res.status(200).json({
    page: Number(req.query.page ?? 1) || 1,
    totalPages: 1,
    totalResults: 0,
    results: [],
  });
});

export default searchRoutes;
