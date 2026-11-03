import Modal from '@app/components/Common/Modal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { useIntl } from 'react-intl';

interface BlocklistModalProps {
  title: string;
  show: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
  isUpdating?: boolean;
}

const messages = defineMessages('component.BlocklistModal', {
  blocklisting: 'Blocklisting',
  blocklistgame: 'Blocklist Game',
});

const BlocklistModal = ({
  title,
  show,
  onComplete,
  onCancel,
  isUpdating,
}: BlocklistModalProps) => {
  const intl = useIntl();

  return (
    <Transition
      as="div"
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      show={show}
    >
      <Modal
        backgroundClickable
        title={intl.formatMessage(messages.blocklistgame)}
        subTitle={title}
        onCancel={onCancel}
        onOk={onComplete}
        okText={
          isUpdating
            ? intl.formatMessage(messages.blocklisting)
            : intl.formatMessage(globalMessages.blocklist)
        }
        okButtonType="danger"
        okDisabled={isUpdating}
      />
    </Transition>
  );
};

export default BlocklistModal;
