import React from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '../../lib/useApiData.js';
import { api } from '../../lib/api.js';
import { Empty, Notice, PageHeader, Panel, ProgressBar, Sparkline, Spinner, Stat } from '../../components/UI.jsx';
import { useLiveEvents } from '../../lib/useLiveEvents.js';

function fmtDate(v){ return v ? new Date(v).toLocaleDateString() : '—'; }

export default function MemberDashboard(){
  const {data,error,loading,reload}=useApiData('/member/dashboard');
  useLiveEvents(reload);
  if(loading) return <div className="portal-loading"><Spinner label="Loading your day"/></div>;
  if(error) return <Notice type="error">{error}</Notice>;
  const a=data.analytics;
  async function markRead(id){ try{await api(`/member/notifications/${id}/read`,{method:'PATCH'});await reload();}catch{} }
  return <>
    <PageHeader eyebrow="YOUR OVERVIEW" title={`Good ${new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, ${data.member.name.split(' ')[0]}.`} copy="Your daily coaching, consistency and gym access — one clear view." action={<Link className="button button-primary" to="/member/today">Open today →</Link>}/>
    {!data.membership && <Notice type="info">You do not have an active membership yet. <Link to="/member/membership"><strong>Choose a membership →</strong></Link></Notice>}
    <div className="stats-grid">
      <Stat label="Current streak" value={`${a.streak} days`} hint="Scheduled training completed"/>
      <Stat label="Workout adherence" value={`${a.workoutAdherence}%`} hint={`${a.completedWorkouts}/${a.scheduledWorkouts} planned sessions`}/>
      <Stat label="Diet adherence" value={`${a.dietAdherence}%`} hint="Last 28 days"/>
      <Stat label="Gym visits" value={a.visits28} hint="Last 28 days"/>
    </div>

    <div className="portal-grid two-thirds">
      <Panel title="Today" copy="What matters right now.">
        {data.today ? <div className="today-focus">
          <div className="today-focus-top"><span className="eyebrow">{data.today.dayType}</span><strong>{data.today.title}</strong><span>{data.today.source === 'AI' ? 'AI Coach' : data.today.trainer?.name || 'Trainer plan'}</span></div>
          <div className="today-quick-grid">
            <div><span>Workout</span><strong>{data.today.dayType === 'REST' ? 'Recovery' : `${data.today.exercises.length} exercises`}</strong></div>
            <div><span>Nutrition</span><strong>{data.today.calorieTarget ? `${data.today.calorieTarget} kcal` : 'Plan ready'}</strong></div>
            <div><span>Attendance</span><strong>{data.todayAttendance.checkedIn ? 'Checked in ✓' : 'Not checked in'}</strong></div>
          </div>
          <Link className="button button-dark" to="/member/today">View today’s plan</Link>
        </div> : <Empty title={data.membership?.kind === 'PERSONAL' ? 'Waiting for today’s trainer plan' : data.membership?.kind === 'AI' ? 'Complete AI onboarding' : 'No plan today'} copy={data.membership?.kind === 'PERSONAL' ? 'Your assigned trainer can publish your workout, diet or recovery day.' : data.membership?.kind === 'AI' ? 'Add your fitness details in Profile so AI Coach can build your first week.' : 'Activate a membership to start daily coaching.'}/>} 
      </Panel>
      <Panel title="Your coaching">
        <div className="coaching-card">
          <span className="eyebrow">MEMBERSHIP</span>
          <h3>{data.membership?.name || 'No active plan'}</h3>
          {data.membership && <p>Valid until {fmtDate(data.membership.endDate)}</p>}
          {data.membership?.kind === 'PERSONAL' && <p>{data.trainer ? `Coach: ${data.trainer.name} · ${data.trainer.specialty}` : 'Trainer assignment pending.'}</p>}
          {data.membership?.kind === 'AI' && <p>Adaptive plan based on your profile and progress.</p>}
          <Link to="/member/membership" className="button button-ghost-dark">Manage membership</Link>
        </div>
      </Panel>
    </div>


    {data.notifications?.length > 0 && <Panel title="Updates" copy="Recent coaching and membership notifications."><div className="notification-list">{data.notifications.map(n=><div className="notification-row" key={n.id}><div><span className="eyebrow">{n.type}</span><strong>{n.title}</strong><p>{n.body}</p></div><button className="inline-button" onClick={()=>markRead(n.id)}>Mark read</button></div>)}</div></Panel>}

    <div className="portal-grid two-thirds">
      <Panel title="28-day consistency" copy="Simple metrics that reflect execution, not vanity.">
        <ProgressBar label="Workouts" value={a.workoutAdherence}/>
        <ProgressBar label="Diet" value={a.dietAdherence}/>
        <div className="micro-note">Rest days do not break your training streak.</div>
      </Panel>
      <Panel title="Weight trend" copy={a.latestWeight ? `Latest ${a.latestWeight} kg${a.weightChange===null?'':` · ${a.weightChange>0?'+':''}${a.weightChange} kg change`}`:'Log your first weight to start analytics.'}>
        <Sparkline values={(data.weightSeries||[]).map(x=>x.value)}/>
        <Link to="/member/progress" className="inline-button">Open progress →</Link>
      </Panel>
    </div>
  </>;
}
