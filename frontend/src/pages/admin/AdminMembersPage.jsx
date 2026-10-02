import React, { useEffect, useMemo, useState } from 'react';
import { api, json } from '../../lib/api.js';
import { Empty, Modal, Notice, PageHeader, Panel, Spinner, Status } from '../../components/UI.jsx';

export default function AdminMembersPage() {
  const [members, setMembers] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);

  async function load() {
    setError('');
    try {
      const [memberRows, trainerRows] = await Promise.all([
        api(`/admin/members?search=${encodeURIComponent(search)}`),
        api('/admin/trainers')
      ]);
      setMembers(memberRows);
      setTrainers(trainerRows.filter(t => t.active && t.portalLinked));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  const trainerOptions = useMemo(
    () => trainers.filter(t => t.activeClients < t.capacity),
    [trainers]
  );

  async function assign(memberId, trainerId) {
    if (!trainerId) return;
    setMessage('');
    try {
      await api('/admin/trainer-assignments', json('POST', { memberId, trainerId: Number(trainerId) }));
      setMessage('Trainer assigned successfully.');
      await load();
    } catch (e) {
      setMessage(e.message);
    }
  }

  function openEdit(member) {
    setEditing({
      id: member.id,
      name: member.name,
      phone: member.phone || '',
      goal: member.goal || '',
      userStatus: member.userStatus || 'ACTIVE'
    });
  }

  async function saveMember(e) {
    e.preventDefault();
    setMessage('');
    try {
      await api(`/admin/members/${editing.id}`, json('PATCH', {
        name: editing.name,
        phone: editing.phone || null,
        goal: editing.goal || null,
        userStatus: editing.userStatus
      }));
      setEditing(null);
      setMessage('Member updated successfully.');
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return <>
    <PageHeader
      eyebrow="MEMBERS"
      title="Every member, clearly."
      copy="Search members, manage account access, review coaching mode and assign Personal Coaching members to active trainer portal accounts."
    />

    {error && <Notice type="error">{error}</Notice>}
    {message && <Notice type={message.includes('successfully') ? 'success' : 'error'}>{message}</Notice>}

    <Panel>
      <div className="table-tools">
        <input
          placeholder="Search name, email or phone"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
        />
        <button className="button button-dark" onClick={load}>Search</button>
      </div>

      {!members ? <Spinner /> : members.length ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Member</th><th>Gym Key</th><th>Face</th><th>Membership</th><th>Trainer</th><th>Actions</th>
            </tr></thead>
            <tbody>{members.map(m => <tr key={m.id}>
              <td><strong>{m.name}</strong><small>{m.email}<br />{m.phone || 'No phone'}</small></td>
              <td><strong>{m.loginKey || '—'}</strong></td>
              <td><Status value={m.faceEnrolled ? 'ACTIVE' : 'PENDING'} /></td>
              <td>
                {m.membership ? <>
                  <strong>{m.membership.name}</strong>
                  <small><Status value={m.membership.status} /></small>
                  {m.nextMembership && <small>Next: {m.nextMembership.name}</small>}
                </> : '—'}
              </td>
              <td>{m.trainer?.name || '—'}</td>
              <td>
                <div className="cell-actions">
                  <button className="inline-button" onClick={() => openEdit(m)}>Edit</button>
                  {m.membership?.kind === 'PERSONAL' && m.membership?.status === 'ACTIVE' ? (
                    <select defaultValue="" onChange={e => assign(m.id, e.target.value)} aria-label={`Assign trainer to ${m.name}`}>
                      <option value="">{m.trainer ? 'Change trainer…' : 'Assign trainer…'}</option>
                      {trainerOptions.map(t => <option key={t.id} value={t.id}>{t.name} ({t.activeClients}/{t.capacity})</option>)}
                    </select>
                  ) : <span className="muted-text">No trainer action</span>}
                </div>
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : <Empty title="No members found" copy="Try another search or create a member from the public signup flow." />}
    </Panel>

    {editing && <Modal title="Edit member" onClose={() => setEditing(null)}>
      <form className="portal-form" onSubmit={saveMember}>
        <div className="form-grid two">
          <label>Name<input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required minLength="2" /></label>
          <label>Phone<input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></label>
          <label>Goal<input value={editing.goal} onChange={e => setEditing({ ...editing, goal: e.target.value })} placeholder="Muscle gain, fat loss, strength…" /></label>
          <label>Account status
            <select value={editing.userStatus} onChange={e => setEditing({ ...editing, userStatus: e.target.value })}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </label>
        </div>
        <p className="form-help">Disabling an account immediately blocks future authenticated portal access. Existing history is preserved.</p>
        <button className="button button-primary">Save member</button>
      </form>
    </Modal>}
  </>;
}
