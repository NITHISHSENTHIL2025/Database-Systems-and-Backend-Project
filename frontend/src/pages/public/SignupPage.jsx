import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { Notice } from '../../components/UI.jsx';

export default function SignupPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', phone:'', goal:'', password:'', confirm:'' });
  const [createdKey, setCreatedKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && !createdKey) return <Navigate to="/member/membership" replace />;

  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true); setError('');
    try {
      const next = await register({ name: form.name, email: form.email, phone: form.phone, goal: form.goal, password: form.password });
      setCreatedKey(next.loginKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (createdKey) {
    return <div className="auth-page auth-paper-page single-auth-success">
      <div className="gym-key-success-card">
        <Brand />
        <span className="eyebrow">ACCOUNT CREATED</span>
        <h1>Your Gym Key</h1>
        <div className="gym-key-big">{createdKey}</div>
        <p>Save this six-digit key. Save this key. It is also visible in Profile. On this browser, future quick sign-in can use the key alone.</p>
        <button className="button button-primary button-full" onClick={() => navigate('/member/membership', { replace: true })}>Choose membership</button>
      </div>
    </div>;
  }

  return (
    <div className="auth-page auth-paper-page signup-layout">
      <div className="auth-brand-panel auth-paper-brand">
        <Brand />
        <div>
          <span className="eyebrow">JOIN GYMFIT</span>
          <h1>Create once.<br/>Use your key.</h1>
          <p>Create your member account, receive your Gym Key, then choose a membership.</p>
        </div>
        <Link to="/" className="auth-back">← Back to GymFit</Link>
      </div>
      <div className="auth-form-panel">
        <form className="auth-form wide" onSubmit={submit}>
          <span className="eyebrow">NEW MEMBER</span>
          <h2>Create account</h2>
          <div className="form-grid two">
            <label>Full name<input value={form.name} onChange={e => setForm({...form,name:e.target.value})} required /></label>
            <label>Email<input type="email" autoComplete="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required /></label>
            <label>Mobile number<input inputMode="tel" placeholder="10-digit mobile" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} /></label>
            <label>Fitness goal<input placeholder="Muscle gain, fat loss, strength…" value={form.goal} onChange={e => setForm({...form,goal:e.target.value})} /></label>
            <label>Password<input type="password" minLength="8" autoComplete="new-password" value={form.password} onChange={e => setForm({...form,password:e.target.value})} required /></label>
            <label>Confirm password<input type="password" minLength="8" autoComplete="new-password" value={form.confirm} onChange={e => setForm({...form,confirm:e.target.value})} required /></label>
          </div>
          {error && <Notice type="error">{error}</Notice>}
          <button className="button button-primary button-full" disabled={busy}>{busy ? 'Creating account…' : 'Create member account'}</button>
          <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
