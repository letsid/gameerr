import usePlatforms from '@app/hooks/usePlatforms';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';
import Select from 'react-select';

const messages = defineMessages('components.PlatformSelector', {
  selectPlatforms: 'Select platforms…',
  noPlatforms: 'No matching platforms',
  loading: 'Loading platforms…',
});

interface PlatformOption {
  value: number;
  label: string;
}

interface PlatformSelectorProps {
  id: string;
  value: number[];
  onChange: (value: number[]) => void;
  isDisabled?: boolean;
}

const PlatformSelector = ({
  id,
  value,
  onChange,
  isDisabled = false,
}: PlatformSelectorProps) => {
  const intl = useIntl();
  const { platforms, byId, isLoading } = usePlatforms();

  const options: PlatformOption[] = platforms.map((platform) => ({
    value: platform.id,
    label: platform.name,
  }));

  // Keep selected ids visible even before the platform list has loaded
  const selected: PlatformOption[] = value.map((platformId) => ({
    value: platformId,
    label: byId.get(platformId)?.name ?? `#${platformId}`,
  }));

  return (
    <Select<PlatformOption, true>
      inputId={id}
      isMulti
      className="react-select-container"
      classNamePrefix="react-select"
      options={options}
      value={selected}
      isLoading={isLoading}
      isDisabled={isDisabled}
      placeholder={intl.formatMessage(messages.selectPlatforms)}
      noOptionsMessage={() => intl.formatMessage(messages.noPlatforms)}
      loadingMessage={() => intl.formatMessage(messages.loading)}
      onChange={(options) => onChange(options.map((option) => option.value))}
    />
  );
};

export default PlatformSelector;
