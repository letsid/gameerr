import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/outline';
import type { FulfillmentSettingsResponse } from '@server/interfaces/api/settingsInterfaces';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { Fragment, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages('components.Settings.SettingsFulfillment', {
  fulfillment: 'Fulfillment & Library',
  fulfillmentDescription:
    'Where approved requests go and which libraries count as owned games.',
  questarrEnabled: 'Use Questarr',
  questarrEnabledTip:
    'Hands PC, Linux and Mac requests to Questarr or QuestarrNG.',
  questarrUrl: 'Questarr URL',
  questarrUrlTip:
    'Address Gameerr reaches Questarr at. The API key comes from QUESTARR_API_KEY.',
  romarrEnabled: 'Use ROMarrNG',
  romarrEnabledTip:
    'Hands requests for every other platform to ROMarrNG. Systems it does not manage, and requests no enabled backend takes, notify the request managers.',
  romarrUrl: 'ROMarrNG URL',
  romarrUrlTip:
    'Address Gameerr reaches ROMarrNG at. The API key comes from ROMARR_API_KEY.',
  keyConfigured: 'API key set',
  keyMissing: 'API key missing',
  testConnection: 'Test',
  testSuccess: 'Connected to {service} {version}.',
  testFailed: '{backend} connection failed: {error}',
  steamIds: 'Steam Accounts',
  steamIdsTip:
    'SteamID64 values, one per line. Their public libraries count as owned PC games. The Web API key comes from STEAM_API_KEY.',
  validationUrl: 'Enter a URL starting with http:// or https://',
  validationSteamIds: 'Each line must be a 17 digit SteamID64',
  toastSaved: 'Fulfillment settings saved.',
  toastFailed: 'Something went wrong while saving the fulfillment settings.',
});

type Backend = 'questarr' | 'romarr';

const backends: {
  id: Backend;
  name: string;
  placeholder: string;
  enabled: 'questarrEnabled' | 'romarrEnabled';
  url: 'questarrUrl' | 'romarrUrl';
  configured: 'questarrConfigured' | 'romarrConfigured';
}[] = [
  {
    id: 'questarr',
    name: 'Questarr',
    placeholder: 'http://questarr:5000',
    enabled: 'questarrEnabled',
    url: 'questarrUrl',
    configured: 'questarrConfigured',
  },
  {
    id: 'romarr',
    name: 'ROMarrNG',
    placeholder: 'http://romarr:6868',
    enabled: 'romarrEnabled',
    url: 'romarrUrl',
    configured: 'romarrConfigured',
  },
];

const SettingsFulfillment = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [testing, setTesting] = useState<Backend>();
  const { data, mutate } = useSWR<FulfillmentSettingsResponse>(
    '/api/v1/settings/fulfillment'
  );

  if (!data) {
    return null;
  }

  const urlSchema = Yup.string().matches(/^(https?:\/\/\S+)?$/, {
    message: intl.formatMessage(messages.validationUrl),
  });
  const schema = Yup.object().shape({
    questarrUrl: urlSchema,
    romarrUrl: urlSchema,
    steamIds: Yup.string().test(
      'steam-ids',
      intl.formatMessage(messages.validationSteamIds),
      (value) =>
        (value ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .every((id) => /^\d{17}$/.test(id))
    ),
  });

  const testConnection = async (backend: (typeof backends)[number]) => {
    setTesting(backend.id);
    try {
      const response = await axios.post<{ service: string; version: string }>(
        `/api/v1/settings/fulfillment/${backend.id}/test`
      );
      addToast(
        intl.formatMessage(messages.testSuccess, {
          service: response.data.service,
          version: response.data.version,
        }),
        { appearance: 'success', autoDismiss: true }
      );
    } catch (e) {
      addToast(
        intl.formatMessage(messages.testFailed, {
          backend: backend.name,
          error: e?.response?.data?.message ?? e.message,
        }),
        { appearance: 'error', autoDismiss: true }
      );
    } finally {
      setTesting(undefined);
    }
  };

  return (
    <div className="mt-10" data-testid="settings-fulfillment">
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.fulfillment)}</h3>
        <p className="description">
          {intl.formatMessage(messages.fulfillmentDescription)}
        </p>
      </div>
      <div className="section">
        <Formik
          initialValues={{
            questarrEnabled: data.questarrEnabled,
            questarrUrl: data.questarrUrl,
            romarrEnabled: data.romarrEnabled,
            romarrUrl: data.romarrUrl,
            steamIds: data.steamIds.join('\n'),
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values) => {
            try {
              await axios.post('/api/v1/settings/fulfillment', {
                questarrEnabled: values.questarrEnabled,
                questarrUrl: values.questarrUrl.trim(),
                romarrEnabled: values.romarrEnabled,
                romarrUrl: values.romarrUrl.trim(),
                steamIds: values.steamIds.split(/\s+/).filter(Boolean),
              });
              addToast(intl.formatMessage(messages.toastSaved), {
                appearance: 'success',
                autoDismiss: true,
              });
            } catch {
              addToast(intl.formatMessage(messages.toastFailed), {
                appearance: 'error',
                autoDismiss: true,
              });
            } finally {
              mutate();
            }
          }}
        >
          {({ errors, touched, isSubmitting, isValid }) => (
            <Form className="section">
              {backends.map((backend) => (
                <Fragment key={backend.id}>
                  <div className="form-row">
                    <label htmlFor={backend.enabled} className="checkbox-label">
                      <span>
                        {intl.formatMessage(messages[backend.enabled])}
                      </span>
                      <span className="label-tip">
                        {intl.formatMessage(messages[`${backend.enabled}Tip`])}
                      </span>
                    </label>
                    <div className="form-input-area">
                      <Field
                        type="checkbox"
                        id={backend.enabled}
                        name={backend.enabled}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor={backend.url} className="text-label">
                      <span>{intl.formatMessage(messages[backend.url])}</span>
                      <span className="label-tip">
                        {intl.formatMessage(messages[`${backend.url}Tip`])}
                      </span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          id={backend.url}
                          name={backend.url}
                          type="text"
                          placeholder={backend.placeholder}
                        />
                        <Button
                          type="button"
                          buttonType="warning"
                          className="ml-2 whitespace-nowrap"
                          disabled={!!testing}
                          onClick={() => testConnection(backend)}
                        >
                          <BeakerIcon />
                          <span>
                            {intl.formatMessage(messages.testConnection)}
                          </span>
                        </Button>
                      </div>
                      <div className="mt-1">
                        <Badge
                          badgeType={
                            data[backend.configured] ? 'success' : 'warning'
                          }
                        >
                          {intl.formatMessage(
                            data[backend.configured]
                              ? messages.keyConfigured
                              : messages.keyMissing
                          )}
                        </Badge>
                      </div>
                      {errors[backend.url] && touched[backend.url] && (
                        <div className="error">{errors[backend.url]}</div>
                      )}
                    </div>
                  </div>
                </Fragment>
              ))}
              <div className="form-row">
                <label htmlFor="steamIds" className="text-label">
                  <span>{intl.formatMessage(messages.steamIds)}</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.steamIdsTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      as="textarea"
                      id="steamIds"
                      name="steamIds"
                      rows={3}
                      placeholder="76561197960287930"
                    />
                  </div>
                  <div className="mt-1">
                    <Badge
                      badgeType={data.steamConfigured ? 'success' : 'warning'}
                    >
                      {intl.formatMessage(
                        data.steamConfigured
                          ? messages.keyConfigured
                          : messages.keyMissing
                      )}
                    </Badge>
                  </div>
                  {errors.steamIds && touched.steamIds && (
                    <div className="error">{errors.steamIds}</div>
                  )}
                </div>
              </div>
              <div className="actions">
                <div className="flex justify-end">
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      type="submit"
                      disabled={isSubmitting || !isValid}
                      data-testid="settings-fulfillment-save"
                    >
                      <ArrowDownOnSquareIcon />
                      <span>
                        {isSubmitting
                          ? intl.formatMessage(globalMessages.saving)
                          : intl.formatMessage(globalMessages.save)}
                      </span>
                    </Button>
                  </span>
                </div>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default SettingsFulfillment;
