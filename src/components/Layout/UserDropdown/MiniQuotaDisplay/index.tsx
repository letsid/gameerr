import InfinityIcon from '@app/assets/infinity.svg';
import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import ProgressCircle from '@app/components/Common/ProgressCircle';
import defineMessages from '@app/utils/defineMessages';
import type { QuotaResponse } from '@server/interfaces/api/userInterfaces';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages(
  'components.Layout.UserDropdown.MiniQuotaDisplay',
  {
    gamerequests: 'Game Requests',
  }
);

type MiniQuotaDisplayProps = {
  userId: number;
};

const MiniQuotaDisplay = ({ userId }: MiniQuotaDisplayProps) => {
  const intl = useIntl();
  const { data, error } = useSWR<QuotaResponse>(`/api/v1/user/${userId}/quota`);

  if (error) {
    return null;
  }

  if (!data && !error) {
    return <SmallLoadingSpinner />;
  }

  return (
    <>
      {(data?.game.limit ?? 0) !== 0 && (
        <div className="flex">
          <div className="flex flex-col space-y-2">
            <div className="text-sm text-gray-200">
              {intl.formatMessage(messages.gamerequests)}
            </div>
            <div className="flex h-full items-center space-x-2 text-gray-200">
              {(data?.game.limit ?? 0) > 0 ? (
                <>
                  <ProgressCircle
                    className="h-8 w-8"
                    progress={Math.round(
                      ((data?.game.remaining ?? 0) / (data?.game.limit ?? 1)) *
                        100
                    )}
                    useHeatLevel
                  />
                  <span className="text-lg font-bold">
                    {data?.game.remaining} / {data?.game.limit}
                  </span>
                </>
              ) : (
                <>
                  <InfinityIcon className="w-7" />
                  <span className="font-bold">Unlimited</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MiniQuotaDisplay;
