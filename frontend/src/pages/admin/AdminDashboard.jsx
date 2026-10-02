import React from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '../../lib/useApiData.js';
import { Notice, PageHeader, Panel, Sparkline, Spinner, Stat, Status } from '../../components/UI.jsx';
import { useLiveEvents } from '../../lib/useLiveEvents.js';

function money(v){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(v)||0)}

export default function AdminDashboard(){
  const {data,error,loading,reload}=useApiData('/admin/dashboard');
  useLiveEvents(reload);
  if(loading)return <Spinner label="Loading GymFit"/>;
  if(error)return <Notice type="error">{error}</Notice>;
  const m=data.metrics;
  return <>
    <PageHeader eyebrow="ADMIN OVERVIEW" title="The gym, at a glance." copy="Members, coaching, attendance, memberships and payments — only the essentials for the review." action={<Link className="button button-primary" to="/admin/attendance">Open Face Attendance →</Link>}/>
    <div className="stats-grid">
      <Stat label="Members" value={m.members}/>
      <Stat label="Active memberships" value={m.activeMemberships} hint={`${m.personal} Personal · ${m.ai} AI`}/>
      <Stat label="Today attendance" value={m.todayAttendance}/>
      <Stat label="Trainers" value={m.trainers}/>
      <Stat label="Revenue this month" value={money(m.revenueThisMonth)}/>
    </div>
    <div className="portal-grid two-thirds">
      <Panel title="30-day attendance"><Sparkline values={data.attendanceSeries.map(x=>x.value)}/></Panel>
      <Panel title="Coaching mix"><div className="profile-summary"><div><span>Personal</span><strong>{m.personal}</strong></div><div><span>AI Coach</span><strong>{m.ai}</strong></div></div></Panel>
    </div>
    <Panel title="Recent payments">{data.recentPayments.length?<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Member</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{data.recentPayments.map(p=><tr key={p.id}><td>{p.member}</td><td>{p.plan}</td><td>{money(p.amount)}</td><td><Status value={p.status}/></td><td>{new Date(p.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>:<p className="muted-text">No payments yet.</p>}</Panel>
  </>;
}
