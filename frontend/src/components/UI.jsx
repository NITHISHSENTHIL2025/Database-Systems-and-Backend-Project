import React from 'react';

export function PageHeader({ eyebrow, title, copy, action }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {copy && <p>{copy}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export function Panel({ title, copy, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || copy) && <div className="panel-head">
        {title && <h2>{title}</h2>}
        {copy && <p>{copy}</p>}
      </div>}
      {children}
    </section>
  );
}

export function Empty({ title = 'Nothing here yet', copy = 'There is no data to show.' }) {
  return <div className="empty-state"><strong>{title}</strong><p>{copy}</p></div>;
}

export function Status({ value }) {
  const clean = String(value || 'UNKNOWN').toLowerCase();
  return <span className={`status status-${clean}`}>{String(value || 'UNKNOWN').replaceAll('_',' ')}</span>;
}

export function Notice({ type = 'info', children }) {
  return <div className={`notice notice-${type}`}>{children}</div>;
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <div className="spinner-row"><span className="spinner" />{label}</div>;
}

export function ProgressBar({ value = 0, label }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="progress-block">
    <div className="progress-label"><span>{label}</span><strong>{safe}%</strong></div>
    <div className="progress-track"><span style={{ width: `${safe}%` }} /></div>
  </div>;
}

export function Sparkline({ values = [] }) {
  if (!values.length) return <div className="sparkline-empty">No data yet</div>;
  const nums = values.map(v => Number(v) || 0);
  const min = Math.min(...nums), max = Math.max(...nums);
  const range = max - min || 1;
  const points = nums.map((v, i) => `${(i / Math.max(1, nums.length - 1)) * 100},${36 - ((v - min) / range) * 30}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}
