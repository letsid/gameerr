import { IGDB_IMAGE_HOST } from '@server/api/igdb/images';
import ImageProxy from '@server/lib/imageproxy';
import logger from '@server/logger';
import { Router } from 'express';

const router = Router();

// Delay the initialization of ImageProxy instances until the proxy (if any) is properly configured
let _igdbImageProxy: ImageProxy;
function initIgdbImageProxy() {
  if (!_igdbImageProxy) {
    _igdbImageProxy = new ImageProxy('igdb', IGDB_IMAGE_HOST, {
      rateLimitOptions: {
        maxRequests: 20,
        maxRPS: 50,
      },
    });
  }
  return _igdbImageProxy;
}

router.get<{
  type: string;
  path: string[];
}>('/:type/*path', async (req, res, next) => {
  const imagePath = '/' + req.params.path.join('/');

  if (imagePath.startsWith('//') || imagePath.includes('://')) {
    logger.error('Invalid URL for image proxy', { imagePath });
    return next({ status: 403, message: 'Invalid URL for image proxy.' });
  }

  try {
    let imageData;
    if (req.params.type === 'igdb') {
      imageData = await initIgdbImageProxy().getImage(imagePath);
    } else {
      logger.error('Unsupported image type', {
        imagePath,
        type: req.params.type,
      });
      return next({ status: 400, message: 'Unsupported image type.' });
    }

    res.writeHead(200, {
      'Content-Type': `image/${imageData.meta.extension}`,
      'Content-Length': imageData.imageBuffer.length,
      'Cache-Control': `public, max-age=${imageData.meta.curRevalidate}`,
      'OS-Cache-Key': imageData.meta.cacheKey,
      'OS-Cache-Status': imageData.meta.cacheMiss ? 'MISS' : 'HIT',
    });

    res.end(imageData.imageBuffer);
  } catch (e) {
    logger.error('Failed to proxy image', {
      imagePath,
      errorMessage: e.message,
    });
    if (!res.headersSent) {
      return next({ status: 500, message: 'Failed to proxy image.' });
    }
    next(e);
  }
});

export default router;
