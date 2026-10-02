import React from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '../../lib/useApiData.js';
import { Empty, Notice, PageHeader, Panel, Spinner, Stat } from '../../components/UI.jsx';
import { useLiveEvents } from '../../lib/useLiveEvents.js';

export default function TrainerDashboard(){
  const {data,error,loading,reload}=useApiData('/trainer/dashboard');
  useLiveEvents(reload);
  if(loading) return <Spinner label="Loading trainer workspace"/>;
  if(error) return <Notice type="error">{error}</Notice>;
  return <>
    <PageHeader eyebrow="TRAINER OVERVIEW" title={`Good to see you, ${data.trainer.name.split(' ')[0]}.`} copy="Your clients, today’s plans and coaching workload." action={<Link className="button button-primary" to="/trainer/clients">Open clients →</Link>}/>
    <div className="stats-grid"><Stat label="Active clients" value={data.metrics.activeClients} hint={`${data.metrics.capacity} max capacity`}/><Stat label="Plans today" value={data.metrics.plansToday} hint="Published daily plans"/><Stat label="Needs plan" value={data.metrics.needsPlan} hint="Assigned clients without today’s plan"/><Stat label="Specialty" value={data.trainer.specialty} hint="Trainer profile"/></div>
    <Panel title="Today’s client board" copy="Personal Coaching clients only.">
      {data.clients.length?<div className="client-grid">{data.clients.map(c=><Link className="client-card" to={`/trainer/clients/${c.id}`} key={c.id}><div><span className="eyebrow">{c.goal||'GENERAL FITNESS'}</span><h3>{c.name}</h3><p>{c.todayPlan?`${c.todayPlan.title} · ${c.todayPlan.completion}% complete`:'No plan published today'}</p></div><strong>{c.weight?`${c.weight} kg`:'→'}</strong></Link>)}</div>:<Empty title="No assigned clients" copy="Admin assigns Personal Coaching members to available trainer accounts."/>}
    </Panel>
  </>;
}
