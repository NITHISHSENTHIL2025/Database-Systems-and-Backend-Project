import React, { useEffect, useState } from 'react';
import { api, json } from '../../lib/api.js';
import { useApiData } from '../../lib/useApiData.js';
import { Empty, Notice, PageHeader, Panel, Spinner, Status } from '../../components/UI.jsx';

function money(v) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v) || 0);
}

export default function AdminMembershipsPage() {
  const memberships = useApiData('/admin/memberships');
  const plans = useApiData('/admin/plans');
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    if (!plans.data) return;
    const next = {};
    plans.data.forEach(p => {
      next[p.id] = {
        name: p.name,
        price: Number(p.price),
        durationDays: p.durationDays,
        description: p.description,
        featuresText: (p.features || []).join('\n'),
        active: p.active
      };
    });
    setDrafts(next);
  }, [plans.data]);

  function patchDraft(id, key, value) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  async function savePlan(plan) {
    const d = drafts[plan.id];
    if (!d) return;
    setMessage('');
    try {
      await api(`/admin/plans/${plan.id}`, json('PATCH', {
        name: d.name,
        price: Number(d.price),
        durationDays: Number(d.durationDays),
        description: d.description,
        features: d.featuresText.split('\n').map(x => x.trim()).filter(Boolean),
        active: Boolean(d.active)
      }));
      setMessage('Membership plan updated successfully.');
      await plans.reload();
    } catch (err) { setMessage(err.message); }
  }

  async function changeStatus(id, status) {
    setMessage('');
    try {
      await api(`/admin/memberships/${id}`, json('PATCH', { status }));
      setMessage('Membership status updated successfully.');
      await memberships.reload();
    } catch (err) { setMessage(err.message); }
  }

  if (memberships.loading || plans.loading) return <Spinner />;
  return <>
    <PageHeader
      eyebrow="MEMBERSHIPS"
      title="Two memberships. No clutter."
      copy="Personal Coaching and AI Coach are the only product plans. Their server-side price is also the amount used when Cashfree creates an order."
    />
    {(memberships.error || plans.error) && <Notice type="error">{memberships.error || plans.error}</Notice>}
    {message && <Notice type={message.includes('successfully') ? 'success' : 'error'}>{message}</Notice>}

    <div className="membership-two-grid admin-plan-grid">
      {plans.data?.map(p => {
        const d = drafts[p.id] || {};
        return <article className={`membership-choice kind-${p.kind.toLowerCase()}`} key={p.id}>
          <div className="plan-top"><span>{p.kind}</span><Status value={d.active ? 'ACTIVE' : 'DISABLED'} /></div>
          <h2>{p.name}</h2>
          <div className="form-grid two">
            <label>Plan name<input value={d.name ?? ''} onChange={e => patchDraft(p.id, 'name', e.target.value)} /></label>
            <label>Status<select value={d.active ? 'ACTIVE' : 'DISABLED'} onChange={e => patchDraft(p.id, 'active', e.target.value === 'ACTIVE')}><option value="ACTIVE">ACTIVE</option><option value="DISABLED">DISABLED</option></select></label>
            <label>Price (₹)<input type="number" min="1" step="1" value={d.price ?? ''} onChange={e => patchDraft(p.id, 'price', e.target.value)} /></label>
            <label>Duration (days)<input type="number" min="1" max="3650" value={d.durationDays ?? ''} onChange={e => patchDraft(p.id, 'durationDays', e.target.value)} /></label>
          </div>
          <label>Description<textarea value={d.description ?? ''} onChange={e => patchDraft(p.id, 'description', e.target.value)} /></label>
          <label>Features <small>one per line</small><textarea rows="7" value={d.featuresText ?? ''} onChange={e => patchDraft(p.id, 'featuresText', e.target.value)} /></label>
          <button className="button button-dark" onClick={() => savePlan(p)}>Save {p.kind === 'AI' ? 'AI Coach' : 'Personal Coaching'}</button>
        </article>;
      })}
    </div>

    <Panel title="Member memberships" copy="Review active, scheduled and previous memberships.">
      {memberships.data?.length ? <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Member</th><th>Plan</th><th>Period</th><th>Paid</th><th>Status</th><th>Control</th></tr></thead>
        <tbody>{memberships.data.map(m => <tr key={m.id}>
          <td><strong>{m.member.user.name}</strong><small>{m.member.user.email}</small></td>
          <td><strong>{m.plan.name}</strong><small>{m.plan.kind}</small></td>
          <td>{new Date(m.startDate).toLocaleDateString()} → {new Date(m.endDate).toLocaleDateString()}</td>
          <td>{money(m.amountPaid)}</td>
          <td><Status value={m.status} /></td>
          <td><select value={m.status} onChange={e => changeStatus(m.id, e.target.value)}>{['ACTIVE', 'SCHEDULED', 'FROZEN', 'CANCELLED', 'EXPIRED'].map(s => <option key={s}>{s}</option>)}</select></td>
        </tr>)}</tbody>
      </table></div> : <Empty />}
    </Panel>
  </>;
}
