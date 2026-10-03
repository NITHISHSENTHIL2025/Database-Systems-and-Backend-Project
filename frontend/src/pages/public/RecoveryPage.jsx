import React, {
  useState
} from 'react';

import {
  Link
} from 'react-router-dom';

import Brand from '../../components/Brand.jsx';

import {
  api,
  json
} from '../../lib/api.js';

import {
  Notice
} from '../../components/UI.jsx';

export default function RecoveryPage() {
  const [
    email,
    setEmail
  ] = useState('');

  const [
    otp,
    setOtp
  ] = useState('');

  const [
    stage,
    setStage
  ] = useState('request');

  const [
    message,
    setMessage
  ] = useState('');

  const [
    error,
    setError
  ] = useState('');

  const [
    recoveredKey,
    setRecoveredKey
  ] = useState('');

  const [
    busy,
    setBusy
  ] = useState(false);

  async function request(e) {
    e.preventDefault();

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result =
        await api(
          '/auth/recovery/request',

          json(
            'POST',
            {
              email
            }
          )
        );

      setStage(
        'verify'
      );

      setMessage(
        result.message ||
          'OTP sent to your registered email.'
      );
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();

    setBusy(true);
    setError('');

    try {
      const result =
        await api(
          '/auth/recovery/verify',

          json(
            'POST',
            {
              email,
              otp
            }
          )
        );

      setRecoveredKey(
        result.loginKey ||
        ''
      );

      setMessage(
        result.message ||
        'Gym Key recovered.'
      );

      setStage(
        'done'
      );
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page auth-paper-page">

      <div className="auth-brand-panel auth-paper-brand">

        <Brand />

        <div>
          <span className="eyebrow">
            ACCOUNT RECOVERY
          </span>

          <h1>
            Find your key.
            <br />
            Get back in.
          </h1>

          <p>
            Use your registered email
            and a six-digit OTP
            to recover your Gym Key.
          </p>
        </div>

        <Link
          to="/login"
          className="auth-back"
        >
          ← Back to sign in
        </Link>

      </div>

      <div className="auth-form-panel">

        {stage === 'request' && (
          <form
            className="auth-form"
            onSubmit={request}
          >

            <span className="eyebrow">
              RECOVERY
            </span>

            <h2>
              Recover Gym Key
            </h2>

            <label>
              Registered email

              <input
                type="email"

                value={
                  email
                }

                onChange={e =>
                  setEmail(
                    e.target.value
                  )
                }

                required
              />
            </label>

            {error && (
              <Notice type="error">
                {error}
              </Notice>
            )}

            <button
              className="button button-primary button-full"

              disabled={busy}
            >
              {busy
                ? 'Preparing…'
                : 'Send OTP'}
            </button>

          </form>
        )}

        {stage === 'verify' && (
          <form
            className="auth-form"
            onSubmit={verify}
          >

            <span className="eyebrow">
              VERIFY OTP
            </span>

            <h2>
              Enter the six-digit code
            </h2>

            {message && (
              <Notice type="info">
                {message}
              </Notice>
            )}

            <label>
              OTP

              <input
                inputMode="numeric"
                maxLength="6"
                pattern="[0-9]{6}"

                value={
                  otp
                }

                onChange={e =>
                  setOtp(
                    e.target.value
                      .replace(
                        /\D/g,
                        ''
                      )
                      .slice(
                        0,
                        6
                      )
                  )
                }

                required
              />
            </label>

            {error && (
              <Notice type="error">
                {error}
              </Notice>
            )}

            <button
              className="button button-primary button-full"

              disabled={busy}
            >
              {busy
                ? 'Verifying…'
                : 'Recover Gym Key'}
            </button>

          </form>
        )}

        {stage === 'done' && (
          <div className="auth-form recovery-done">

            <span className="eyebrow">
              DONE
            </span>

            <h2>
              Your Gym Key
            </h2>

            {recoveredKey && (
              <div className="gym-key-big small">
                {recoveredKey}
              </div>
            )}

            <p>
              {message}
            </p>

            <Link
              className="button button-primary button-full"
              to="/login"
            >
              Back to sign in
            </Link>

          </div>
        )}

      </div>

    </div>
  );
}