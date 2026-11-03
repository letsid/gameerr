import Button from '@app/components/Common/Button';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages('components.Setup.SetupLocal', {
  title: 'Create the admin account',
  description:
    'This account signs in with email and password. You can connect Jellyfin, Plex or Emby sign-in later in the settings.',
  email: 'Email Address',
  username: 'Display Name',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  create: 'Create Account',
  creating: 'Creating…',
  back: 'Go back',
  validationEmail: 'You must provide a valid email address',
  validationPassword: 'The password must be at least 8 characters long',
  validationPasswordMatch: 'Passwords must match',
  setupFailed: 'The admin account could not be created.',
});

interface SetupLocalProps {
  onCancel: () => void;
  onComplete: () => void;
}

const SetupLocal = ({ onCancel, onComplete }: SetupLocalProps) => {
  const intl = useIntl();
  const { revalidate } = useUser();
  const [error, setError] = useState<string | null>(null);

  const schema = Yup.object().shape({
    email: Yup.string()
      .required(intl.formatMessage(messages.validationEmail))
      .email(intl.formatMessage(messages.validationEmail)),
    username: Yup.string(),
    password: Yup.string()
      .required(intl.formatMessage(messages.validationPassword))
      .min(8, intl.formatMessage(messages.validationPassword)),
    confirmPassword: Yup.string()
      .required(intl.formatMessage(messages.validationPasswordMatch))
      .oneOf(
        [Yup.ref('password')],
        intl.formatMessage(messages.validationPasswordMatch)
      ),
  });

  return (
    <div className="p-4">
      <div className="mb-2 flex justify-center text-xl font-bold">
        {intl.formatMessage(messages.title)}
      </div>
      <div className="mb-6 flex justify-center text-center text-sm text-gray-300">
        {intl.formatMessage(messages.description)}
      </div>
      <Formik
        initialValues={{
          email: '',
          username: '',
          password: '',
          confirmPassword: '',
        }}
        validationSchema={schema}
        onSubmit={async (values) => {
          setError(null);
          try {
            await axios.post('/api/v1/auth/local/setup', {
              email: values.email,
              username: values.username || undefined,
              password: values.password,
            });
            const { data: user } = await axios.get('/api/v1/auth/me');
            revalidate(user, false);
            onComplete();
          } catch (e) {
            setError(
              e?.response?.data?.message ??
                intl.formatMessage(messages.setupFailed)
            );
          }
        }}
      >
        {({ errors, touched, isSubmitting, isValid }) => (
          <Form className="mx-auto max-w-md">
            {[
              { name: 'email', label: messages.email, type: 'email' },
              { name: 'username', label: messages.username, type: 'text' },
            ].map((field) => (
              <div className="mb-4" key={field.name}>
                <label htmlFor={field.name} className="text-label">
                  {intl.formatMessage(field.label)}
                </label>
                <div className="form-input-field mt-1">
                  <Field
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    data-testid={`setup-local-${field.name}`}
                  />
                </div>
                {errors[field.name as keyof typeof errors] &&
                  touched[field.name as keyof typeof touched] && (
                    <div className="error">
                      {errors[field.name as keyof typeof errors]}
                    </div>
                  )}
              </div>
            ))}
            {[
              { name: 'password', label: messages.password },
              { name: 'confirmPassword', label: messages.confirmPassword },
            ].map((field) => (
              <div className="mb-4" key={field.name}>
                <label htmlFor={field.name} className="text-label">
                  {intl.formatMessage(field.label)}
                </label>
                <div className="form-input-field mt-1">
                  <SensitiveInput
                    as="field"
                    id={field.name}
                    name={field.name}
                    autoComplete="new-password"
                    data-testid={`setup-local-${field.name}`}
                  />
                </div>
                {errors[field.name as keyof typeof errors] &&
                  touched[field.name as keyof typeof touched] && (
                    <div className="error">
                      {errors[field.name as keyof typeof errors]}
                    </div>
                  )}
              </div>
            ))}
            {error && <div className="error mb-4">{error}</div>}
            <div className="flex justify-between">
              <Button buttonType="default" type="button" onClick={onCancel}>
                {intl.formatMessage(messages.back)}
              </Button>
              <Button
                buttonType="primary"
                type="submit"
                disabled={isSubmitting || !isValid}
                data-testid="setup-local-submit"
              >
                {isSubmitting
                  ? intl.formatMessage(messages.creating)
                  : intl.formatMessage(messages.create)}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default SetupLocal;
