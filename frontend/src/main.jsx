import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import { api } from './services/api.js';
import { MembersPage, MembershipsPage, TrainersPage, AttendancePage, WorkoutsPage, EquipmentPage, PaymentsPage } from './pages/AdminPages.jsx';
import { MyMembershipPage, MyAttendancePage, MyWorkoutsPage, MyPaymentsPage } from './pages/MemberPages.jsx';

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('gym_user') || 'null'));
  const [page, setPage] = useState('Overview');
  const [authPage, setAuthPage] = useState('login');
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => { if (user) api('/dashboard').then(setDashboard).catch(() => logout()); }, [user]);
  function loginUser(nextUser) { setUser(nextUser); setPage('Overview'); setAuthPage('login'); }
  function logout() { localStorage.removeItem('gym_token'); localStorage.removeItem('gym_user'); setUser(null); setDashboard(null); setAuthPage('login'); }

  if (!user) return authPage === 'signup' ? <SignupPage onAuth={loginUser} onBack={() => setAuthPage('login')}/> : <LoginPage onAuth={loginUser} onSignup={() => setAuthPage('signup')}/>;

  const content = user.role === 'ADMIN' ? {
    'Overview': <OverviewPage role="ADMIN" data={dashboard} user={user} setPage={setPage}/>,
    'Members': <MembersPage/>,
    'Memberships': <MembershipsPage/>,
    'Trainers': <TrainersPage/>,
    'Attendance': <AttendancePage/>,
    'Workouts': <WorkoutsPage/>,
    'Equipment': <EquipmentPage/>,
    'Payments': <PaymentsPage/>
  } : {
    'Overview': <OverviewPage role="MEMBER" data={dashboard} user={user} setPage={setPage}/>,
    'My Membership': <MyMembershipPage/>,
    'My Attendance': <MyAttendancePage/>,
    'My Workouts': <MyWorkoutsPage/>,
    'My Payments': <MyPaymentsPage/>
  };
  const subtitle = user.role === 'ADMIN' ? 'Manage members, plans and club operations.' : 'Your personal membership and fitness records.';
  return <div className="app-shell"><Sidebar role={user.role} page={page} setPage={setPage} user={user} onLogout={logout}/><main className="main"><Topbar title={page} subtitle={subtitle}/><div className="page-body">{content[page]}</div></main></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
