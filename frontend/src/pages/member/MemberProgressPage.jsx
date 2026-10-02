import React from 'react';
import { useApiData } from '../../lib/useApiData.js';
import { Empty, Notice, PageHeader, Panel, ProgressBar, Sparkline, Spinner, Stat } from '../../components/UI.jsx';

export default function MemberProgressPage(){
  const {data,error,loading}=useApiData('/member/progress?days=90');
  if(loading) return <Spinner label="Loading progress"/>;
  if(error) return <Notice type="error">{error}</Notice>;
  const rows=data.metrics||[];
  const latest=rows[0];
  return <>
    <PageHeader eyebrow="PROGRESS" title="Your consistency, clearly." copy="Progress is for trends and coaching analytics. Update age, height, weight and body type from Profile."/>
    <div className="stats-grid">
      <Stat label="Current weight" value={latest?`${latest.weightKg} kg`:'—'} hint="From profile / coach updates"/>
      <Stat label="Workout consistency" value={`${data.consistency.workout}%`} hint="Last 90 days"/>
      <Stat label="Diet adherence" value={`${data.consistency.diet}%`} hint="Logged meals"/>
      <Stat label="Gym visits" value={data.consistency.visits} hint={`${data.consistency.streak}-session streak`}/>
    </div>

    <div className="portal-grid two-thirds">
      <Panel title="Weight trend" copy="Weight updates from your profile or trainer appear here automatically.">
        <Sparkline values={rows.slice().reverse().map(r=>r.weightKg)}/>
        {rows.length?<div className="metric-history">{rows.slice(0,8).map(r=><div key={r.id}><strong>{r.weightKg} kg</strong><span>{new Date(r.recordedAt).toLocaleDateString()} · {r.source}</span></div>)}</div>:<Empty title="No weight history yet" copy="Add your weight in Profile. Your future changes will appear here."/>}
      </Panel>
      <Panel title="Consistency score" copy="Simple behavioral analytics from your actual plan completion and attendance.">
        <ProgressBar label="Workouts" value={data.consistency.workout}/>
        <ProgressBar label="Diet" value={data.consistency.diet}/>
        <div className="profile-summary">
          <div><span>Visits</span><strong>{data.consistency.visits}</strong></div>
          <div><span>Training streak</span><strong>{data.consistency.streak}</strong></div>
        </div>
      </Panel>
    </div>
  </>;
}
