import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Brand from './Brand.jsx';
import { useAuth } from '../lib/auth.jsx';

const navs = {
  MEMBER: [
    ['Overview', '/member'],
    ['Today', '/member/today'],
    ['Progress', '/member/progress'],
    ['Membership', '/member/membership'],
    ['Profile', '/member/profile']
  ],
  TRAINER: [
    ['Overview', '/trainer'],
    ['My Members', '/trainer/clients'],
    ['Profile', '/trainer/profile']
  ],
  ADMIN: [
    ['Overview', '/admin'],
    ['Members', '/admin/members'],
    ['Trainers', '/admin/trainers'],
    ['Face Attendance', '/admin/attendance'],
    ['Memberships', '/admin/memberships'],
    ['Payments', '/admin/payments']
  ]
};

export default function PortalShell({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = navs[role] || [];
  async function signOut() { await logout(); navigate('/'); }
  return (
    <div className={`portal-shell role-${role.toLowerCase()}`}>
      <aside className="portal-sidebar">
        <div>
          <Brand compact />
          <div className="portal-user">
            <span className="eyebrow">{role === 'ADMIN' ? 'ADMIN' : role === 'TRAINER' ? 'TRAINER' : 'MEMBER'}</span>
            <strong>{user?.name}</strong>
            <small>{user?.loginKey ? `Key ${user.loginKey}` : user?.email}</small>
          </div>
          <nav className="portal-nav">
            {nav.map(([label, path], index) => (
              <NavLink key={path} to={path} end={index === 0} className={({isActive}) => isActive ? 'active' : ''}>
                <span>{String(index + 1).padStart(2,'0')}</span>{label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="sidebar-foot">
          <a href="/">Public site ↗</a>
          <button onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="portal-main"><Outlet /></main>
    </div>
  );
}
