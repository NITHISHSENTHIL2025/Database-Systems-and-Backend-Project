import React, { useState } from 'react';
import { api, json } from '../../lib/api.js';
import { useApiData } from '../../lib/useApiData.js';
import { Empty, Modal, Notice, PageHeader, Panel, Spinner, Status } from '../../components/UI.jsx';

const blank = { name: '', email: '', phone: '', specialty: 'Strength & Conditioning', bio: '', capacity: 20, password: '' };

export default function AdminTrainersPage() {
  const { data, error, loading, reload } = useApiData('/admin/trainers');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(blank);

  async function submitCreate(e) {
    e.preventDefault(); setMessage('');
    try {
      const created = await api('/admin/trainers', json('POST', { ...form, capacity: Number(form.capacity) }));
      setCreating(false); setForm(blank);
      setMessage(`Trainer created. Staff Key: ${created.loginKey}`);
      await reload();
    } catch (err) { setMessage(err.message); }
  }

  function openEdit(t) {
    setEditing({ id: t.id, name: t.name, phone: t.phone || '', specialty: t.specialty, bio: t.bio || '', capacity: t.capacity, active: t.active });
  }

  async function submitEdit(e) {
    e.preventDefault(); setMessage('');
    try {
      await api(`/admin/trainers/${editing.id}`, json('PATCH', {
        name: editing.name,
        phone: editing.phone || null,
        specialty: editing.specialty,
        bio: editing.bio || null,
        capacity: Number(editing.capacity),
        active: editing.active
      }));
      setEditing(null);
      setMessage('Trainer updated successfully.');
      await reload();
    } catch (err) { setMessage(err.message); }
  }

  if (loading) return <Spinner />;
  return <>
    <PageHeader eyebrow="TRAINERS" title="Human coaching operations." copy="Create secure trainer portal accounts, manage capacity and control trainer access. Only active linked trainers can receive Personal Coaching clients." action={<button className="button button-primary" onClick={() => setCreating(true)}>+ Trainer account</button>} />
    {error && <Notice type="error">{error}</Notice>}
    {message && <Notice type={message.includes('created') || message.includes('updated') ? 'success' : 'error'}>{message}</Notice>}

    <Panel>
      {data?.length ? <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Trainer</th><th>Staff Key</th><th>Specialty</th><th>Clients</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{data.map(t => <tr key={t.id}>
          <td><strong>{t.name}</strong><small>{t.email || 'No email'}<br />{t.phone || 'No phone'}</small></td>
          <td><strong>{t.loginKey || '—'}</strong></td><td>{t.specialty}</td><td>{t.activeClients}/{t.capacity}</td><td><Status value={t.active ? 'ACTIVE' : 'DISABLED'} /></td>
          <td><button className="inline-button" onClick={() => openEdit(t)}>Edit</button></td>
        </tr>)}</tbody>
      </table></div> : <Empty />}
    </Panel>

    {creating && <Modal title="Create trainer portal account" onClose={() => setCreating(false)}>
      <form className="portal-form" onSubmit={submitCreate}>
        <div className="form-grid two">
          <label>Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Specialty<input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} required /></label>
          <label>Client capacity<input type="number" min="1" max="100" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} /></label>
          <label>Temporary password<input type="password" minLength="8" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></label>
        </div>
        <label>Bio<textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></label>
        <p className="form-help">Share the temporary password privately. The trainer should change it after first sign-in.</p>
        <button className="button button-primary">Create account</button>
      </form>
    </Modal>}

    {editing && <Modal title="Edit trainer" onClose={() => setEditing(null)}>
      <form className="portal-form" onSubmit={submitEdit}>
        <div className="form-grid two">
          <label>Name<input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required /></label>
          <label>Phone<input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></label>
          <label>Specialty<input value={editing.specialty} onChange={e => setEditing({ ...editing, specialty: e.target.value })} required /></label>
          <label>Client capacity<input type="number" min="1" max="100" value={editing.capacity} onChange={e => setEditing({ ...editing, capacity: e.target.value })} /></label>
          <label>Status<select value={editing.active ? 'ACTIVE' : 'DISABLED'} onChange={e => setEditing({ ...editing, active: e.target.value === 'ACTIVE' })}><option value="ACTIVE">ACTIVE</option><option value="DISABLED">DISABLED</option></select></label>
        </div>
        <label>Bio<textarea value={editing.bio} onChange={e => setEditing({ ...editing, bio: e.target.value })} /></label>
        <button className="button button-primary">Save trainer</button>
      </form>
    </Modal>}
  </>;
}
