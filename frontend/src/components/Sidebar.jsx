import Brand from './Brand.jsx';

const adminItems = [['Overview', '▦'], ['Members', '♙'], ['Memberships', '◷'], ['Trainers', '✦'], ['Attendance', '✓'], ['Workouts', '↗'], ['Equipment', '□'], ['Payments', '₹']];
const memberItems = [['Overview', '▦'], ['My Membership', '◷'], ['My Attendance', '✓'], ['My Workouts', '↗'], ['My Payments', '₹']];

export default function Sidebar({ role, page, setPage, user, onLogout }) {
  const items = role === 'ADMIN' ? adminItems : memberItems;
  return <aside className="sidebar"><Brand/><div className="side-label">{role === 'ADMIN' ? 'CLUB OPERATIONS' : 'MEMBER PORTAL'}</div><nav>{items.map(([label, icon]) => <button key={label} className={page === label ? 'nav-item active' : 'nav-item'} onClick={() => setPage(label)}><span>{icon}</span>{label}</button>)}</nav><div className="side-bottom"><div className="profile-card"><div className="avatar">{user.name?.[0]?.toUpperCase() || 'U'}</div><div><strong>{user.name}</strong><span>{role === 'ADMIN' ? 'Administrator' : 'Member'}</span></div></div><button className="logout" onClick={onLogout}>↪ <span>Sign out</span></button></div></aside>;
}
