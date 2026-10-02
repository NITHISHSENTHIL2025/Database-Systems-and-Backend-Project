import React, { useState } from 'react';
import { api, json } from '../../lib/api.js';
import { useApiData } from '../../lib/useApiData.js';
import { Notice, PageHeader, Panel, Spinner, Stat } from '../../components/UI.jsx';

export default function TrainerProfilePage() {
  const { data, error, loading } = useApiData('/trainer/profile');
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');

  async function changePassword(e) {
    e.preventDefault(); setMessage('');
    try { await api('/auth/password', json('POST', password)); setPassword({ currentPassword: '', newPassword: '' }); setMessage('Password changed successfully.'); }
    catch (err) { setMessage(err.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <Notice type="error">{error}</Notice>;
  return <>
    <PageHeader eyebrow="TRAINER PROFILE" title={data.name} copy={data.specialty}/>
    {message && <Notice type={message.includes('successfully')?'success':'error'}>{message}</Notice>}
    <section className="gym-key-panel"><div><span className="eyebrow">STAFF KEY</span><strong>{data.loginKey || '------'}</strong><p>Use this Gym Key to sign in. The same login automatically opens your trainer portal.</p></div></section>
    <div className="stats-grid"><Stat label="Active clients" value={data.activeClients}/><Stat label="Capacity" value={data.capacity}/><Stat label="Available slots" value={Math.max(0,data.capacity-data.activeClients)}/></div>
    <div className="two-column-grid">
      <Panel title="Profile"><div className="profile-summary"><div><span>Email</span><strong>{data.email||'—'}</strong></div><div><span>Phone</span><strong>{data.phone||'—'}</strong></div><div><span>Specialty</span><strong>{data.specialty}</strong></div></div></Panel>
      <Panel title="Security"><form className="portal-form" onSubmit={changePassword}><label>Current password<input type="password" minLength="8" value={password.currentPassword} onChange={e=>setPassword({...password,currentPassword:e.target.value})} required/></label><label>New password<input type="password" minLength="8" value={password.newPassword} onChange={e=>setPassword({...password,newPassword:e.target.value})} required/></label><button className="button button-dark">Change password</button></form></Panel>
    </div>
  </>;
}
