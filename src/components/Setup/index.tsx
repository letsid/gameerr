import AppDataWarning from '@app/components/AppDataWarning';
import Button from '@app/components/Common/Button';
import PageTitle from '@app/components/Common/PageTitle';
import LanguagePicker from '@app/components/Layout/LanguagePicker';
import SetupLocal from '@app/components/Setup/SetupLocal';
import SetupSteps from '@app/components/Setup/SetupSteps';
import useLocale from '@app/hooks/useLocale';
import useSettings from '@app/hooks/useSettings';
import defineMessages from '@app/utils/defineMessages';
import { MediaServerType } from '@server/constants/server';
import axios from 'axios';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { mutate } from 'swr';

const messages = defineMessages('components.Setup', {
  welcome: 'Welcome to Gameerr',
  setup: 'Setup',
  createaccount: 'Create Admin Account',
  finishstep: 'Finish',
  finish: 'Finish Setup',
  finishing: 'Finishing…',
  done: 'Your admin account is ready',
  doneDescription:
    'Set your platforms, IGDB and the download backends in the settings after you sign in.',
});

const Setup = () => {
  const intl = useIntl();
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const router = useRouter();
  const { locale } = useLocale();
  const settings = useSettings();

  const finishSetup = async () => {
    setIsUpdating(true);
    const response = await axios.post<{ initialized: boolean }>(
      '/api/v1/settings/initialize'
    );

    setIsUpdating(false);
    if (response.data.initialized) {
      await axios.post('/api/v1/settings/main', { locale });
      mutate('/api/v1/settings/public');

      router.push('/');
    }
  };

  useEffect(() => {
    if (settings.currentSettings.initialized) {
      router.push('/');
    }

    // The admin account already exists, only finishing is left
    if (
      settings.currentSettings.mediaServerType !==
      MediaServerType.NOT_CONFIGURED
    ) {
      setCurrentStep(2);
    }
  }, [
    settings.currentSettings.mediaServerType,
    settings.currentSettings.initialized,
    router,
  ]);

  if (settings.currentSettings.initialized) return <></>;

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-gray-900 py-12">
      <PageTitle title={intl.formatMessage(messages.setup)} />
      <div className="absolute right-4 top-4 z-50">
        <LanguagePicker />
      </div>
      <div className="relative z-40 px-4 sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="relative mb-10 h-48 max-w-full sm:mx-auto sm:h-64 sm:max-w-md">
          <Image src="/logo_stacked.svg" alt="Logo" fill />
        </div>
        <AppDataWarning />
        <nav className="relative z-50">
          <ul
            className="divide-y divide-gray-600 rounded-md border border-gray-600 bg-gray-800/50 md:flex md:divide-y-0"
            style={{ backdropFilter: 'blur(5px)' }}
          >
            <SetupSteps
              stepNumber={1}
              description={intl.formatMessage(messages.createaccount)}
              active={currentStep === 1}
              completed={currentStep > 1}
            />
            <SetupSteps
              stepNumber={2}
              description={intl.formatMessage(messages.finishstep)}
              active={currentStep === 2}
              isLastStep
            />
          </ul>
        </nav>
        <div className="mt-10 w-full rounded-md border border-gray-600 bg-gray-800/50 p-4 text-white">
          {currentStep === 1 && (
            <SetupLocal onComplete={() => setCurrentStep(2)} />
          )}
          {currentStep === 2 && (
            <div className="flex flex-col items-center p-2 pb-6">
              <div className="mb-2 text-xl font-bold">
                {intl.formatMessage(messages.done)}
              </div>
              <div className="mb-6 text-center text-sm text-gray-300">
                {intl.formatMessage(messages.doneDescription)}
              </div>
              <Button
                buttonType="primary"
                onClick={() => finishSetup()}
                disabled={isUpdating}
                data-testid="setup-finish"
              >
                {isUpdating
                  ? intl.formatMessage(messages.finishing)
                  : intl.formatMessage(messages.finish)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Setup;
