import React, { useState } from 'react';
import {
  Link,
  Navigate,
  useNavigate
} from 'react-router-dom';

import Brand from '../../components/Brand.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { Notice } from '../../components/UI.jsx';

function destination(role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'TRAINER') return '/trainer';
  return '/member';
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [loginKey, setLoginKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <Navigate
        to={destination(user.role)}
        replace
      />
    );
  }

  async function submit(e) {
    e.preventDefault();

    setError('');
    setBusy(true);

    try {
      const next = await login(loginKey);

      navigate(
        destination(next.role),
        { replace: true }
      );
    } catch (err) {
      setError(err.message);
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
            WELCOME BACK
          </span>

          <h1>
            One key.
            <br />
            Right portal.
          </h1>

          <p>
            Enter your six-digit Gym Key.
            GymFit identifies your role and opens
            the correct Member, Trainer or Admin portal.
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
        <form
          className="auth-form"
          onSubmit={submit}
        >
          <span className="eyebrow">
            SIGN IN
          </span>

          <h2>
            Open GymFit
          </h2>

          <label>
            Gym Key

            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength="6"
              placeholder="6-digit key"
              autoFocus
              value={loginKey}
              onChange={e =>
                setLoginKey(
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
              loginKey.length !== 6
            }
          >
            {busy
              ? 'Signing in…'
              : 'Sign in'}
          </button>

          <div className="auth-link-row">
            <Link to="/recover">
              Forgot your Gym Key?
            </Link>
          </div>

          <p className="auth-switch">
            New to GymFit?{' '}
            <Link to="/signup">
              Create account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
