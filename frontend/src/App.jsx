import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PortalShell from './components/PortalShell.jsx';
import HomePage from './pages/public/HomePage.jsx';
import LoginPage from './pages/public/LoginPage.jsx';
import SignupPage from './pages/public/SignupPage.jsx';
import RecoveryPage from './pages/public/RecoveryPage.jsx';

import MemberDashboard from './pages/member/MemberDashboard.jsx';
import MemberTodayPage from './pages/member/MemberTodayPage.jsx';
import MemberProgressPage from './pages/member/MemberProgressPage.jsx';
import MembershipPage from './pages/member/MembershipPage.jsx';
import MemberProfilePage from './pages/member/MemberProfilePage.jsx';

import TrainerDashboard from './pages/trainer/TrainerDashboard.jsx';
import TrainerClientsPage from './pages/trainer/TrainerClientsPage.jsx';
import TrainerClientPage from './pages/trainer/TrainerClientPage.jsx';
import TrainerProfilePage from './pages/trainer/TrainerProfilePage.jsx';

import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminMembersPage from './pages/admin/AdminMembersPage.jsx';
import AdminTrainersPage from './pages/admin/AdminTrainersPage.jsx';
import AdminMembershipsPage from './pages/admin/AdminMembershipsPage.jsx';
import AdminAttendancePage from './pages/admin/AdminAttendancePage.jsx';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage.jsx';

export default function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/recover" element={<RecoveryPage />} />

    <Route path="/member" element={<ProtectedRoute role="MEMBER"><PortalShell role="MEMBER" /></ProtectedRoute>}>
      <Route index element={<MemberDashboard />} />
      <Route path="today" element={<MemberTodayPage />} />
      <Route path="progress" element={<MemberProgressPage />} />
      <Route path="membership" element={<MembershipPage />} />
      <Route path="profile" element={<MemberProfilePage />} />
    </Route>

    <Route path="/trainer" element={<ProtectedRoute role="TRAINER"><PortalShell role="TRAINER" /></ProtectedRoute>}>
      <Route index element={<TrainerDashboard />} />
      <Route path="clients" element={<TrainerClientsPage />} />
      <Route path="clients/:memberId" element={<TrainerClientPage />} />
      <Route path="profile" element={<TrainerProfilePage />} />
    </Route>

    <Route path="/admin" element={<ProtectedRoute role="ADMIN"><PortalShell role="ADMIN" /></ProtectedRoute>}>
      <Route index element={<AdminDashboard />} />
      <Route path="members" element={<AdminMembersPage />} />
      <Route path="trainers" element={<AdminTrainersPage />} />
      <Route path="attendance" element={<AdminAttendancePage />} />
      <Route path="memberships" element={<AdminMembershipsPage />} />
      <Route path="payments" element={<AdminPaymentsPage />} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
