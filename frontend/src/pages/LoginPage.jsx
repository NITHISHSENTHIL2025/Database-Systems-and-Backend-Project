import { useState } from 'react';
import Brand from '../components/Brand.jsx';
import { api } from '../services/api.js';

export default function LoginPage({ onAuth, onSignup }) {
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('Admin 123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event) { event.preventDefault(); setLoading(true); setError(''); try { const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); localStorage.setItem('gym_token', result.token); localStorage.setItem('gym_user', JSON.stringify(result.user)); onAuth(result.user); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return <div className="auth-shell"><div className="auth-orb orb-a"></div><div className="auth-orb orb-b"></div><div className="auth-card clay-card"><Brand/><div className="auth-copy"><span className="eyebrow">SECURE CLUB ACCESS</span><h1>Welcome back.</h1><p>One workspace for club operations and member fitness tracking.</p></div><form onSubmit={submit}><label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required/></label><label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label>{error && <div className="error-banner">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button></form><div className="signup-line">New member? <button onClick={onSignup}>Create your account →</button></div><div className="demo-note"><strong>Demo access</strong><span>Admin · admin@gmail.com · Admin 123</span><span>Member · member@gmail.com · Member 123</span></div></div></div>;
}
