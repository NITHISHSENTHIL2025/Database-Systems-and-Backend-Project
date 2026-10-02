import React from 'react';
import { Link } from 'react-router-dom';

export default function Brand({ compact = false, link = true }) {
  const mark = (
    <div className={`brand brand-gymfit ${compact ? 'brand-compact' : ''}`}>
      <span className="brand-logo-crop" aria-hidden="true">
        <img src="/gymfit-logo.png" alt="" />
      </span>
      {!compact && <span className="brand-word">GymFit</span>}
    </div>
  );
  return link ? <Link to="/" className="brand-link" aria-label="GymFit home">{mark}</Link> : mark;
}
