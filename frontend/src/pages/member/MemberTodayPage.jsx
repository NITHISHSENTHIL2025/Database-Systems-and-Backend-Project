import React, { useState } from 'react';
import { api, json } from '../../lib/api.js';
import { useApiData } from '../../lib/useApiData.js';
import { Empty, Notice, Panel, Spinner, Status } from '../../components/UI.jsx';
import { useLiveEvents } from '../../lib/useLiveEvents.js';

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }).format(value);
}
function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MemberTodayPage() {
  const { data, error, loading, reload } = useApiData('/member/today');
  useLiveEvents(reload);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');

  async function exercise(id, status) {
    setBusy(`e${id}`); setActionError('');
    try { await api(`/member/today/exercises/${id}`, json('PATCH', { status })); await reload(); }
    catch (err) { setActionError(err.message); }
    finally { setBusy(''); }
  }
  async function meal(id, status) {
    setBusy(`m${id}`); setActionError('');
    try { await api(`/member/today/meals/${id}`, json('PATCH', { status })); await reload(); }
    catch (err) { setActionError(err.message); }
    finally { setBusy(''); }
  }

  if (loading) return <Spinner label="Loading today"/>;
  if (error) return <Notice type="error">{error}</Notice>;

  const membership = data?.membership || null;
  const plan = data?.plan || null;
  const checkedIn = Boolean(data?.attendance?.checkedIn);
  const isRest = plan?.dayType === 'REST';
  const coach = plan?.source === 'AI' ? 'AI Coach' : plan?.trainer?.name || 'Personal Coaching';
  const exercises = plan?.exercises || [];
  const meals = plan?.meals || [];
  const completed = exercises.filter(x => x.status === 'COMPLETED').length;

  return <>
    <header className="today-compact-head">
      <div>
        <span className="eyebrow">{formatDate(new Date())}</span>
        <h1>{plan ? (isRest ? 'Recovery day' : plan.title) : 'Today'}</h1>
        <p>{membership ? `${membership.name} · ${coach}` : 'Activate a membership to start your daily plan.'}</p>
      </div>
      {membership && <div className={checkedIn ? 'checkin-success-chip' : 'face-checkin-chip'}>
        {checkedIn ? <><span>✓ Checked in</span><strong>{formatTime(data.attendance.checkInAt)}</strong></> : <><span>Attendance</span><strong>Face check-in at reception</strong></>}
      </div>}
    </header>

    {actionError && <Notice type="error">{actionError}</Notice>}
    {!membership && <Notice type="info">Choose Personal Coaching or AI Coach from Membership to activate daily plans.</Notice>}
    {membership && !plan && <Notice type="info">{membership.kind === 'PERSONAL' ? 'Your trainer has not published today’s plan yet.' : 'Complete your profile and AI Coach setup to generate today’s plan.'}</Notice>}

    {plan && <>
      <section className="today-plan-card">
        <div className="today-plan-main">
          <div className="today-plan-copy">
            <span className="eyebrow">TODAY AT A GLANCE</span>
            <h2>{plan.title}</h2>
            <p>{plan.notes || (isRest ? 'Recover well and prepare for the next training day.' : 'Review your plan before you begin.')}</p>
          </div>
          <div className="today-preview-pills">
            <span>{isRest ? 'Recovery' : `${exercises.length} exercises`}</span>
            {plan.calorieTarget && <span>{plan.calorieTarget} kcal</span>}
            {plan.proteinTarget && <span>{plan.proteinTarget}g protein</span>}
            {plan.stepsTarget && <span>{plan.stepsTarget} steps</span>}
          </div>
        </div>

        {!isRest && <div className="workout-preview-list">{exercises.slice(0,4).map((item,index) => <div key={item.id}><span>{String(index+1).padStart(2,'0')}</span><strong>{item.exerciseName}</strong><small>{item.sets} × {item.reps}</small></div>)}{exercises.length > 4 && <div className="preview-more">+ {exercises.length - 4} more</div>}</div>}

        {!isRest && !checkedIn && <div className="today-unlock-strip"><div><strong>Workout logging is locked until attendance.</strong><span>At the gym entrance, the admin uses Face Attendance. Once you are matched, this page unlocks automatically.</span></div><span className="face-badge">FACE CHECK-IN</span></div>}
        {!isRest && checkedIn && <div className="today-ready-strip"><strong>Workout unlocked</strong><span>{completed}/{exercises.length} exercises completed</span></div>}
        {isRest && <div className="recovery-compact-grid"><div><span>Movement</span><strong>Light mobility</strong></div><div><span>Steps</span><strong>{plan.stepsTarget || 8000}</strong></div><div><span>Water</span><strong>{plan.waterMlTarget ? `${plan.waterMlTarget} ml` : '2.5 L'}</strong></div><div><span>Focus</span><strong>Sleep + recovery</strong></div></div>}
      </section>

      <section className="today-section">
        <div className="today-section-head"><div><span className="eyebrow">NUTRITION</span><h2>Today’s diet</h2></div><p>Meals are available all day, even before gym check-in.</p></div>
        {meals.length ? <div className="day-meal-grid">{meals.map(m => <article className={`day-meal-card meal-${m.status.toLowerCase()}`} key={m.id}>
          <div className="day-meal-top"><div><span>{m.timeLabel || 'Meal'}</span><h3>{m.name}</h3></div><Status value={m.status}/></div>
          <ul className="day-meal-items">{(Array.isArray(m.items) ? m.items : []).map((item,i)=><li key={`${m.id}-${i}`}>{item}</li>)}</ul>
          <div className="day-meal-macros"><div><span>Calories</span><strong>{m.calories ?? '—'}</strong></div><div><span>Protein</span><strong>{m.protein != null ? `${m.protein}g` : '—'}</strong></div><div><span>Carbs</span><strong>{m.carbs != null ? `${m.carbs}g` : '—'}</strong></div><div><span>Fat</span><strong>{m.fat != null ? `${m.fat}g` : '—'}</strong></div></div>
          <div className="day-meal-actions"><button disabled={busy===`m${m.id}`} className={m.status==='DONE'?'active':''} onClick={()=>meal(m.id,'DONE')}>Done</button><button disabled={busy===`m${m.id}`} className={m.status==='PARTIAL'?'active':''} onClick={()=>meal(m.id,'PARTIAL')}>Partial</button><button disabled={busy===`m${m.id}`} className={m.status==='SKIPPED'?'active':''} onClick={()=>meal(m.id,'SKIPPED')}>Skip</button></div>
        </article>)}</div> : <Panel><Empty title="No diet assigned today"/></Panel>}
      </section>

      {!isRest && checkedIn && <section className="today-section">
        <div className="today-section-head"><div><span className="eyebrow">WORKOUT</span><h2>Workout session</h2></div><p>Complete exercises as you perform them.</p></div>
        <div className="compact-workout-card">{exercises.map((e,i)=><div className={`compact-workout-row ${e.status==='COMPLETED'?'done':''}`} key={e.id}>
          <span className="compact-workout-index">{String(i+1).padStart(2,'0')}</span>
          <div className="compact-workout-main"><strong>{e.exerciseName}</strong><span>{e.sets} sets · {e.reps}{e.targetWeightKg ? ` · ${e.targetWeightKg} kg` : ''}{e.restSeconds ? ` · ${e.restSeconds}s rest` : ''}</span>{e.notes && <small>{e.notes}</small>}</div>
          <div className="compact-workout-actions"><Status value={e.status}/><button className="inline-button" disabled={busy===`e${e.id}`} onClick={()=>exercise(e.id,e.status==='COMPLETED'?'PENDING':'COMPLETED')}>{e.status==='COMPLETED'?'Undo':'Complete'}</button></div>
        </div>)}</div>
      </section>}
    </>}
  </>;
}
