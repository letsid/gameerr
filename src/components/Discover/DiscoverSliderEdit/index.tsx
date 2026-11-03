import Button from '@app/components/Common/Button';
import SlideCheckbox from '@app/components/Common/SlideCheckbox';
import Tooltip from '@app/components/Common/Tooltip';
import { sliderTitles } from '@app/components/Discover/constants';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import {
  Bars3Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { DiscoverSliderType } from '@server/constants/discover';
import type DiscoverSlider from '@server/entity/DiscoverSlider';
import axios from 'axios';
import { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-aria';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverSliderEdit', {
  deletesuccess: 'Sucessfully deleted slider.',
  deletefail: 'Failed to delete slider.',
  remove: 'Remove',
  enable: 'Toggle Visibility',
});

const Position = {
  None: 'None',
  Above: 'Above',
  Below: 'Below',
} as const;

type DiscoverSliderEditProps = {
  slider: Partial<DiscoverSlider>;
  onEnable: () => void;
  onDelete: () => void;
  onPositionUpdate: (
    updatedItemId: number,
    position: keyof typeof Position,
    isClickable: boolean
  ) => void;
  children: React.ReactNode;
  disableUpButton: boolean;
  disableDownButton: boolean;
};

const DiscoverSliderEdit = ({
  slider,
  children,
  onEnable,
  onDelete,
  onPositionUpdate,
  disableUpButton,
  disableDownButton,
}: DiscoverSliderEditProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const ref = useRef<HTMLDivElement>(null);
  const [hoverPosition, setHoverPosition] = useState<keyof typeof Position>(
    Position.None
  );

  const { dragProps, isDragging } = useDrag({
    getItems() {
      return [{ id: (slider.id ?? -1).toString(), title: slider.title ?? '' }];
    },
  });

  const deleteSlider = async () => {
    try {
      await axios.delete(`/api/v1/settings/discover/${slider.id}`);
      addToast(intl.formatMessage(messages.deletesuccess), {
        appearance: 'success',
        autoDismiss: true,
      });
      onDelete();
    } catch {
      addToast(intl.formatMessage(messages.deletefail), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const { dropProps } = useDrop({
    ref,
    onDropMove: (e) => {
      if (ref.current) {
        const middlePoint = ref.current.offsetHeight / 2;

        if (e.y < middlePoint) {
          setHoverPosition(Position.Above);
        } else {
          setHoverPosition(Position.Below);
        }
      }
    },
    onDropExit: () => {
      setHoverPosition(Position.None);
    },
    onDrop: async (e) => {
      const items = await Promise.all(
        e.items
          .filter((item) => item.kind === 'text' && item.types.has('id'))
          .map(async (item) => {
            if (item.kind === 'text') {
              return item.getText('id');
            }
          })
      );
      if (items?.[0]) {
        const dropped = Number(items[0]);
        onPositionUpdate(dropped, hoverPosition, false);
      }
    },
  });

  const getSliderTitle = (slider: Partial<DiscoverSlider>): string => {
    switch (slider.type) {
      case DiscoverSliderType.RECENTLY_ADDED:
        return intl.formatMessage(sliderTitles.recentlyAdded);
      case DiscoverSliderType.RECENT_REQUESTS:
        return intl.formatMessage(sliderTitles.recentrequests);
      case DiscoverSliderType.WATCHLIST:
        return intl.formatMessage(sliderTitles.watchlist);
      case DiscoverSliderType.RECENT_RELEASES:
        return intl.formatMessage(sliderTitles.recentreleases);
      case DiscoverSliderType.UPCOMING:
        return intl.formatMessage(sliderTitles.upcoming);
      case DiscoverSliderType.ALL_TIME_BEST:
        return intl.formatMessage(sliderTitles.alltimebest);
      case DiscoverSliderType.BEST_OF_YEAR:
        return intl.formatMessage(sliderTitles.bestofyear);
      case DiscoverSliderType.GENRE:
        return slider.title ?? intl.formatMessage(sliderTitles.genre);
      case DiscoverSliderType.TRENDING:
        return intl.formatMessage(sliderTitles.trending);
      default:
        return slider.title ?? 'Unknown Slider';
    }
  };

  return (
    <div
      key={`discover-slider-${slider.id}-editing`}
      data-testid="discover-slider-edit-mode"
      className={`relative mb-4 rounded-lg bg-gray-800 shadow-md ${
        isDragging ? 'opacity-0' : 'opacity-100'
      }`}
      {...dragProps}
      {...dropProps}
      ref={ref}
    >
      {hoverPosition === Position.Above && (
        <div
          className={`absolute -top-3 left-0 w-full border-t-4 border-indigo-500`}
        />
      )}
      {hoverPosition === Position.Below && (
        <div
          className={`absolute -bottom-2 left-0 w-full border-t-4 border-indigo-500`}
        />
      )}
      <div className="flex w-full flex-col rounded-t-lg border-l border-r border-t border-gray-800 bg-gray-900 p-4 text-gray-400 md:flex-row md:items-center md:space-x-2">
        <div className="mb-0 flex space-x-2">
          <Bars3Icon className="h-6 w-6" />
          <div className="w-7/12 truncate md:w-full">
            {getSliderTitle(slider)}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center space-x-2">
          {!slider.isBuiltIn && (
            <Button
              data-testid="discover-slider-remove-button"
              buttonType="danger"
              buttonSize="sm"
              onClick={() => {
                deleteSlider();
              }}
            >
              <XMarkIcon />
              <span>{intl.formatMessage(messages.remove)}</span>
            </Button>
          )}
          <div className="absolute right-14 top-4 flex px-2 md:relative md:right-0 md:top-0">
            <button
              className={'hover:text-white disabled:text-gray-800'}
              onClick={() =>
                onPositionUpdate(Number(slider.id), Position.Above, true)
              }
              disabled={disableUpButton}
            >
              <ChevronUpIcon className="h-7 w-7 md:h-6 md:w-6" />
            </button>
            <button
              className={'hover:text-white disabled:text-gray-800'}
              onClick={() =>
                onPositionUpdate(Number(slider.id), Position.Below, true)
              }
              disabled={disableDownButton}
            >
              <ChevronDownIcon className="h-7 w-7 md:h-6 md:w-6" />
            </button>
          </div>
          <div className="absolute right-4 top-4 flex-1 text-right md:relative md:right-0 md:top-0">
            <Tooltip content={intl.formatMessage(messages.enable)}>
              <div>
                <SlideCheckbox
                  onClick={() => {
                    onEnable();
                  }}
                  checked={slider.enabled}
                />
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className={`-mt-6 p-4 ${!slider.enabled ? 'opacity-50' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default DiscoverSliderEdit;
