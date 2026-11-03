import { MediaServerType } from '@server/constants/server';
import {
  isDiscoverRefreshRunning,
  refreshAllDiscoverLists,
} from '@server/lib/discover';
import ImageProxy from '@server/lib/imageproxy';
import refreshToken from '@server/lib/refreshToken';
import type { JobId } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import schedule from 'node-schedule';

interface ScheduledJob {
  id: JobId;
  job: schedule.Job;
  name: string;
  type: 'process' | 'command';
  interval: 'seconds' | 'minutes' | 'hours' | 'days' | 'fixed';
  cronSchedule: string;
  running?: () => boolean;
  cancelFn?: () => void;
}

export const scheduledJobs: ScheduledJob[] = [];

export const startJobs = (): void => {
  // Reruns once a media server is set after boot
  scheduledJobs.forEach((scheduledJob) => scheduledJob.job.cancel());
  scheduledJobs.length = 0;

  const jobs = getSettings().jobs;
  const mediaServerType = getSettings().main.mediaServerType;

  if (mediaServerType === MediaServerType.PLEX) {
    // Keeps Plex sign-in tokens of linked users fresh
    scheduledJobs.push({
      id: 'plex-refresh-token',
      name: 'Plex Refresh Token',
      type: 'process',
      interval: 'fixed',
      cronSchedule: jobs['plex-refresh-token'].schedule,
      job: schedule.scheduleJob(jobs['plex-refresh-token'].schedule, () => {
        logger.info('Starting scheduled job: Plex Refresh Token', {
          label: 'Jobs',
        });
        refreshToken.run();
      }),
    });
  }

  // Run image cache cleanup every 24 hours
  scheduledJobs.push({
    id: 'image-cache-cleanup',
    name: 'Image Cache Cleanup',
    type: 'process',
    interval: 'hours',
    cronSchedule: jobs['image-cache-cleanup'].schedule,
    job: schedule.scheduleJob(jobs['image-cache-cleanup'].schedule, () => {
      logger.info('Starting scheduled job: Image Cache Cleanup', {
        label: 'Jobs',
      });
      // Clean IGDB image cache
      ImageProxy.clearCache('igdb');

      // Clean users avatar image cache
      ImageProxy.clearCache('avatar');
    }),
  });

  // Precompute discover lists so pages never wait on IGDB
  scheduledJobs.push({
    id: 'discover-lists-refresh',
    name: 'Discover Lists Refresh',
    type: 'process',
    interval: 'hours',
    cronSchedule: jobs['discover-lists-refresh'].schedule,
    running: isDiscoverRefreshRunning,
    job: schedule.scheduleJob(jobs['discover-lists-refresh'].schedule, () => {
      logger.info('Starting scheduled job: Discover Lists Refresh', {
        label: 'Jobs',
      });
      refreshAllDiscoverLists().catch((e) =>
        logger.error('Discover lists refresh failed', {
          label: 'Jobs',
          errorMessage: e.message,
        })
      );
    }),
  });

  // Fill in lists that are missing, e.g. on first start
  refreshAllDiscoverLists({ force: false }).catch((e) =>
    logger.error('Initial discover lists refresh failed', {
      label: 'Jobs',
      errorMessage: e.message,
    })
  );

  logger.info('Scheduled jobs loaded', { label: 'Jobs' });
};
