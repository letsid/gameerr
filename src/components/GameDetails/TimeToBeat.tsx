import Tooltip from '@app/components/Common/Tooltip';
import defineMessages from '@app/utils/defineMessages';
import type { GameTimeToBeatResponse } from '@server/interfaces/api/gameInterfaces';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.GameDetails.TimeToBeat', {
  timeToBeat: 'Time to beat',
  hastily: 'Rushed',
  normally: 'Normal',
  completely: 'Completionist',
  hours: '{hours} h',
  submissions:
    'Based on {count, plural, one {# submission} other {# submissions}} on IGDB',
});

const SECONDS_PER_HOUR = 3600;

// One decimal below ten hours, whole hours above
export const formatHours = (seconds: number): string => {
  const hours = seconds / SECONDS_PER_HOUR;
  return hours < 10 ? hours.toFixed(1) : String(Math.round(hours));
};

const TimeToBeat = ({ gameId }: { gameId: number }) => {
  const intl = useIntl();
  const { data } = useSWR<GameTimeToBeatResponse>(
    `/api/v1/game/${gameId}/time-to-beat`
  );
  const time = data?.timeToBeat;

  if (!time) {
    return null;
  }

  const entries = (['hastily', 'normally', 'completely'] as const).filter(
    (key) => time[key]
  );

  const content = (
    <span
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-300"
      data-testid="time-to-beat"
    >
      <span className="font-semibold text-gray-200">
        {intl.formatMessage(messages.timeToBeat)}
      </span>
      {entries.map((key) => (
        <span key={key}>
          <span className="text-gray-400">
            {intl.formatMessage(messages[key])}{' '}
          </span>
          {intl.formatMessage(messages.hours, {
            hours: formatHours(time[key] as number),
          })}
        </span>
      ))}
    </span>
  );

  return time.count ? (
    <Tooltip
      content={intl.formatMessage(messages.submissions, { count: time.count })}
    >
      {content}
    </Tooltip>
  ) : (
    content
  );
};

export default TimeToBeat;
