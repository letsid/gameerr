import usePlatforms, { platformLabel } from '@app/hooks/usePlatforms';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.PlatformTabs', {
  platform: 'Platform',
});

interface PlatformTabsProps {
  platforms: number[];
  selected: number;
  onSelect: (platform: number) => void;
}

const PlatformTabs = ({ platforms, selected, onSelect }: PlatformTabsProps) => {
  const intl = useIntl();
  const { byId } = usePlatforms();

  return (
    <div
      className="mb-2 mt-4 flex flex-wrap items-center gap-2"
      role="tablist"
      aria-label={intl.formatMessage(messages.platform)}
      data-testid="discover-platform-tabs"
    >
      {platforms.map((platform) => {
        const isSelected = platform === selected;

        return (
          <button
            key={`platform-tab-${platform}`}
            type="button"
            role="tab"
            aria-selected={isSelected}
            title={byId.get(platform)?.name}
            onClick={() => onSelect(platform)}
            className={`rounded-full border px-4 py-1 text-sm font-medium transition ${
              isSelected
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400 hover:text-white'
            }`}
          >
            {platformLabel(platform, byId)}
          </button>
        );
      })}
    </div>
  );
};

export default PlatformTabs;
