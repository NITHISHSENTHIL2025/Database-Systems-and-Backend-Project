import { useState } from 'react';
import Brand from '../components/Brand.jsx';
import { api } from '../services/api.js';

export default function SignupPage({ onAuth, onBack }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', goal: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const update = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  async function submit(event) { event.preventDefault(); if (form.password !== form.confirmPassword) return setError('Passwords do not match.'); setLoading(true); setError(''); try { const result = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, goal: form.goal, password: form.password }) }); localStorage.setItem('gym_token', result.token); localStorage.setItem('gym_user', JSON.stringify(result.user)); onAuth(result.user); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return <div className="auth-shell"><div className="auth-card clay-card signup-card"><button className="back-link" onClick={onBack}>← Back to sign in</button><Brand/><div className="auth-copy"><span className="eyebrow">MEMBER REGISTRATION</span><h1>Create your account.</h1><p>Public registration creates a member account only. Admin access is never exposed through signup.</p></div><form onSubmit={submit} className="form-grid"><label>Full name<input value={form.name} onChange={update('name')} required/></label><label>Email<input type="email" value={form.email} onChange={update('email')} required/></label><label>Phone<input value={form.phone} onChange={update('phone')} /></label><label>Fitness goal<input value={form.goal} onChange={update('goal')} placeholder="Strength, weight loss…"/></label><label>Password<input type="password" value={form.password} onChange={update('password')} minLength={8} required/></label><label>Confirm password<input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} minLength={8} required/></label>{error && <div className="error-banner full-span">{error}</div>}<button className="primary-button full-span" disabled={loading}>{loading ? 'Creating…' : 'Create member account'}</button></form></div></div>;
}
