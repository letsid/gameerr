import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/outline';
import type { FulfillmentSettingsResponse } from '@server/interfaces/api/settingsInterfaces';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages('components.Settings.SettingsFulfillment', {
  fulfillment: 'Fulfillment & Library',
  fulfillmentDescription:
    'Where approved requests go and which libraries count as owned games.',
  provider: 'Fulfillment Backend',
  providerTip:
    'Questarr takes PC, Linux and Mac games. Requests for other platforms notify the request managers.',
  providerManual: 'Manual (notify request managers)',
  providerQuestarr: 'Questarr',
  questarrUrl: 'Questarr URL',
  questarrUrlTip:
    'Address Gameerr reaches Questarr at. The API key comes from QUESTARR_API_KEY.',
  keyConfigured: 'API key set',
  keyMissing: 'API key missing',
  testConnection: 'Test',
  testSuccess: 'Connected to {service} {version}.',
  testFailed: 'Questarr connection failed: {error}',
  steamIds: 'Steam Accounts',
  steamIdsTip:
    'SteamID64 values, one per line. Their public libraries count as owned PC games. The Web API key comes from STEAM_API_KEY.',
  validationUrl: 'Enter a URL starting with http:// or https://',
  validationSteamIds: 'Each line must be a 17 digit SteamID64',
  toastSaved: 'Fulfillment settings saved.',
  toastFailed: 'Something went wrong while saving the fulfillment settings.',
});

const SettingsFulfillment = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [isTesting, setTesting] = useState(false);
  const { data, mutate } = useSWR<FulfillmentSettingsResponse>(
    '/api/v1/settings/fulfillment'
  );

  if (!data) {
    return null;
  }

  const schema = Yup.object().shape({
    questarrUrl: Yup.string().matches(/^(https?:\/\/\S+)?$/, {
      message: intl.formatMessage(messages.validationUrl),
    }),
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

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await axios.post<{ service: string; version: string }>(
        '/api/v1/settings/fulfillment/questarr/test'
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
          error: e?.response?.data?.message ?? e.message,
        }),
        { appearance: 'error', autoDismiss: true }
      );
    } finally {
      setTesting(false);
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
            provider: data.provider,
            questarrUrl: data.questarrUrl,
            steamIds: data.steamIds.join('\n'),
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values) => {
            try {
              await axios.post('/api/v1/settings/fulfillment', {
                provider: values.provider,
                questarrUrl: values.questarrUrl.trim(),
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
              <div className="form-row">
                <label htmlFor="provider" className="text-label">
                  <span>{intl.formatMessage(messages.provider)}</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.providerTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field as="select" id="provider" name="provider">
                      <option value="manual">
                        {intl.formatMessage(messages.providerManual)}
                      </option>
                      <option value="questarr">
                        {intl.formatMessage(messages.providerQuestarr)}
                      </option>
                    </Field>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="questarrUrl" className="text-label">
                  <span>{intl.formatMessage(messages.questarrUrl)}</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.questarrUrlTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="questarrUrl"
                      name="questarrUrl"
                      type="text"
                      placeholder="http://questarr:5000"
                    />
                    <Button
                      type="button"
                      buttonType="warning"
                      className="ml-2 whitespace-nowrap"
                      disabled={isTesting}
                      onClick={() => testConnection()}
                    >
                      <BeakerIcon />
                      <span>{intl.formatMessage(messages.testConnection)}</span>
                    </Button>
                  </div>
                  <div className="mt-1">
                    <Badge
                      badgeType={
                        data.questarrConfigured ? 'success' : 'warning'
                      }
                    >
                      {intl.formatMessage(
                        data.questarrConfigured
                          ? messages.keyConfigured
                          : messages.keyMissing
                      )}
                    </Badge>
                  </div>
                  {errors.questarrUrl && touched.questarrUrl && (
                    <div className="error">{errors.questarrUrl}</div>
                  )}
                </div>
              </div>
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
