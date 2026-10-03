import React, {
  useEffect,
  useState
} from 'react';

import {
  Link,
  Navigate,
  useNavigate
} from 'react-router-dom';

import Brand from '../../components/Brand.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { Notice } from '../../components/UI.jsx';

const GOALS = [
  {
    value: 'MUSCLE_GAIN',
    label: 'Muscle Gain'
  },
  {
    value: 'FAT_LOSS',
    label: 'Fat Loss'
  },
  {
    value: 'STRENGTH',
    label: 'Strength'
  },
  {
    value: 'FITNESS',
    label: 'General Fitness'
  }
];

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');

  if (!name || !domain) {
    return email;
  }

  const visible = name.slice(0, Math.min(3, name.length));
  const hidden = '*'.repeat(Math.max(3, name.length - visible.length));

  return `${visible}${hidden}@${domain}`;
}

export default function SignupPage() {
  const {
    user,
    requestRegistration,
    verifyRegistration
  } = useAuth();

  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    goal: ''
  });

  const [stage, setStage] = useState('details');
  const [otp, setOtp] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setResendIn(value =>
        value <= 1 ? 0 : value - 1
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendIn]);

  if (createdKey) {
    return (
      <div className="auth-page auth-paper-page single-auth-success">
        <div className="gym-key-success-card">
          <Brand />

          <span className="eyebrow">
            EMAIL VERIFIED
          </span>

          <h1>
            Your Gym Key
          </h1>

          <div className="gym-key-big">
            {createdKey}
          </div>

          <p>
            Your account is now active.
            Save this six-digit key — it is your
            GymFit sign-in key and remains available
            later in Profile.
          </p>

          <button
            type="button"
            className="button button-dark button-full"
            onClick={async () => {
              await navigator.clipboard?.writeText(createdKey);
              setCopied(true);
              window.setTimeout(
                () => setCopied(false),
                1300
              );
            }}
          >
            {copied
              ? 'Gym Key copied'
              : 'Copy Gym Key'}
          </button>

          <button
            type="button"
            className="button button-primary button-full"
            onClick={() =>
              navigate(
                '/member/membership',
                { replace: true }
              )
            }
          >
            Choose membership
          </button>
        </div>
      </div>
    );
  }

  if (user && stage === 'details') {
    return (
      <Navigate
        to="/member/membership"
        replace
      />
    );
  }

  async function sendOtp(e) {
    e?.preventDefault?.();

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await requestRegistration({
        name: form.name,
        email: form.email,
        phone: form.phone,
        goal: form.goal
      });

      setStage('verify');
      setOtp('');
      setResendIn(
        Number(result.resendAfterSeconds || 60)
      );
      setMessage(
        result.message ||
        'Verification code sent to your email.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();

    setBusy(true);
    setError('');

    try {
      const result = await verifyRegistration({
        email: form.email,
        otp
      });

      setCreatedKey(
        result.loginKey ||
        result.user?.loginKey ||
        ''
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    if (busy || resendIn > 0) {
      return;
    }

    await sendOtp();
  }

  function changeDetails() {
    setStage('details');
    setOtp('');
    setMessage('');
    setError('');
    setResendIn(0);
  }

  return (
    <div className="auth-page auth-paper-page signup-layout">
      <div className="auth-brand-panel auth-paper-brand">
        <Brand />

        <div>
          <span className="eyebrow">
            JOIN GYMFIT
          </span>

          <h1>
            Verify first.
            <br />
            Get your key.
          </h1>

          <p>
            Create your member profile, verify your
            email with a one-time code, then GymFit
            generates your unique Gym Key.
          </p>
        </div>

        <Link
          to="/"
          className="auth-back"
        >
          ← Back to GymFit
        </Link>
      </div>

      <div className="auth-form-panel">
        {stage === 'details' && (
          <form
            className="auth-form wide"
            onSubmit={sendOtp}
          >
            <span className="eyebrow">
              NEW MEMBER · STEP 1 OF 2
            </span>

            <h2>
              Create account
            </h2>

            <div className="form-grid two">
              <label>
                Full name

                <input
                  autoComplete="name"
                  value={form.name}
                  onChange={e =>
                    setForm({
                      ...form,
                      name: e.target.value
                    })
                  }
                  required
                />
              </label>

              <label>
                Email

                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={e =>
                    setForm({
                      ...form,
                      email: e.target.value
                    })
                  }
                  required
                />
              </label>

              <label>
                Mobile number

                <input
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="10-digit mobile"
                  value={form.phone}
                  onChange={e =>
                    setForm({
                      ...form,
                      phone: e.target.value
                    })
                  }
                />
              </label>

              <label>
                Fitness goal

                <select
                  value={form.goal}
                  onChange={e =>
                    setForm({
                      ...form,
                      goal: e.target.value
                    })
                  }
                  required
                >
                  <option value="">
                    Select your goal
                  </option>

                  {GOALS.map(goal => (
                    <option
                      key={goal.value}
                      value={goal.value}
                    >
                      {goal.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
                ? 'Sending verification code…'
                : 'Continue & verify email'}
            </button>

            <p className="auth-switch">
              Already registered?{' '}
              <Link to="/login">
                Sign in
              </Link>
            </p>
          </form>
        )}

        {stage === 'verify' && (
          <form
            className="auth-form"
            onSubmit={verifyOtp}
          >
            <span className="eyebrow">
              VERIFY EMAIL · STEP 2 OF 2
            </span>

            <h2>
              Check your inbox
            </h2>

            <p className="form-help">
              We sent a six-digit verification code to{' '}
              <strong>{maskEmail(form.email)}</strong>.
              Your Gym Key is generated only after this code is verified.
            </p>

            {message && (
              <Notice type="info">
                {message}
              </Notice>
            )}

            <label>
              Verification code

              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength="6"
                placeholder="6-digit OTP"
                autoFocus
                value={otp}
                onChange={e =>
                  setOtp(
                    e.target.value
                      .replace(/\D/g, '')
                      .slice(0, 6)
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
              disabled={
                busy ||
                otp.length !== 6
              }
            >
              {busy
                ? 'Verifying…'
                : 'Verify email & create account'}
            </button>

            <div className="auth-link-row">
              <button
                type="button"
                className="auth-mode-back"
                onClick={resendOtp}
                disabled={
                  busy ||
                  resendIn > 0
                }
              >
                {resendIn > 0
                  ? `Resend code in ${resendIn}s`
                  : 'Resend verification code'}
              </button>
            </div>

            <div className="auth-link-row">
              <button
                type="button"
                className="auth-mode-back"
                onClick={changeDetails}
                disabled={busy}
              >
                ← Change account details
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
