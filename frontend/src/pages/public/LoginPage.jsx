import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { Notice } from '../../components/UI.jsx';

function destination(role){ return role==='ADMIN'?'/admin':role==='TRAINER'?'/trainer':'/member'; }

export default function LoginPage(){
  const { user, quickLogin, login }=useAuth();
  const navigate=useNavigate();
  const [loginKey,setLoginKey]=useState('');
  const [password,setPassword]=useState('');
  const [passwordRequired,setPasswordRequired]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  if(user) return <Navigate to={destination(user.role)} replace/>;

  async function submit(e){
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if(!passwordRequired){
        const result=await quickLogin(loginKey);
        if(result.user) return navigate(destination(result.user.role),{replace:true});
        setPasswordRequired(true);
        return;
      }
      const next=await login(loginKey,password);
      navigate(destination(next.role),{replace:true});
    } catch(err){ setError(err.message); } finally { setBusy(false); }
  }

  return <div className="auth-page auth-paper-page">
    <div className="auth-brand-panel auth-paper-brand">
      <Brand/>
      <div><span className="eyebrow">WELCOME BACK</span><h1>One key.<br/>Right portal.</h1><p>Enter your Gym Key. On a trusted browser, that is enough. A new browser asks for your password once.</p></div>
      <Link to="/" className="auth-back">← Back to GymFit</Link>
    </div>
    <div className="auth-form-panel">
      <form className="auth-form" onSubmit={submit}>
        <span className="eyebrow">SIGN IN</span><h2>Open GymFit</h2>
        <label>Gym Key<input inputMode="numeric" autoComplete="username" pattern="[0-9]{6}" maxLength="6" placeholder="6-digit key" value={loginKey} onChange={e=>{setLoginKey(e.target.value.replace(/\D/g,'').slice(0,6));setPasswordRequired(false);setPassword('');}} required/></label>
        {passwordRequired && <label>Password<input type="password" autoFocus autoComplete="current-password" minLength="8" value={password} onChange={e=>setPassword(e.target.value)} required/></label>}
        {error&&<Notice type="error">{error}</Notice>}
        <button className="button button-primary button-full" disabled={busy}>{busy?'Signing in…':passwordRequired?'Sign in':'Continue'}</button>
        <div className="auth-link-row"><Link to="/recover">Forgot Gym Key or password?</Link></div>
        <p className="auth-switch">New to GymFit? <Link to="/signup">Create account</Link></p>
      </form>
    </div>
  </div>;
}
