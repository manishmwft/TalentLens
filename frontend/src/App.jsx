import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RoleRoute from './components/RoleRoute.jsx';
import CandidateProtectedRoute from './components/candidate/CandidateProtectedRoute.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import CandidateLayout from './layouts/CandidateLayout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NewScreeningPage from './pages/NewScreeningPage.jsx';
import OrganizationSettingsPage from './pages/OrganizationSettingsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ScreeningDetailPage from './pages/ScreeningDetailPage.jsx';
import ScreeningHistoryPage from './pages/ScreeningHistoryPage.jsx';
import UserManagementPage from './pages/UserManagementPage.jsx';
import InterviewDashboardPage from './pages/InterviewDashboardPage.jsx';
import InterviewWorkspacePage from './pages/InterviewWorkspacePage.jsx';
import JobDescriptionsPage from './pages/JobDescriptionsPage.jsx';
import WebsiteApplicationsPage from './pages/WebsiteApplicationsPage.jsx';
import CandidateLoginPage from './pages/candidate/CandidateLoginPage.jsx';
import CandidateChangePasswordPage from './pages/candidate/CandidateChangePasswordPage.jsx';
import CandidateDashboardPage from './pages/candidate/CandidateDashboardPage.jsx';
import CandidateInterviewOverviewPage from './pages/candidate/CandidateInterviewOverviewPage.jsx';
import CandidateForgotPasswordPage from './pages/candidate/CandidateForgotPasswordPage.jsx';
import CandidateResetPasswordPage from './pages/candidate/CandidateResetPasswordPage.jsx';
import CandidateInterviewsPage from './pages/candidate/CandidateInterviewsPage.jsx';
import CandidateProfilePage from './pages/candidate/CandidateProfilePage.jsx';
import CandidateConsentPage from './pages/candidate/CandidateConsentPage.jsx';
import CandidateDeviceCheckPage from './pages/candidate/CandidateDeviceCheckPage.jsx';
import CandidateInterviewInstructionsPage from './pages/candidate/CandidateInterviewInstructionsPage.jsx';
import CandidateInterviewReadyPage from './pages/candidate/CandidateInterviewReadyPage.jsx';
import CandidateAutomatedInterviewPage from './pages/candidate/CandidateAutomatedInterviewPage.jsx';
import CandidateInterviewSubmittedPage from './pages/candidate/CandidateInterviewSubmittedPage.jsx';
import { ROLES } from './constants/roles.js';

export default function App() {
  const allRoles = [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER, ROLES.INTERVIEWER];

  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />

    <Route path="/candidate/login" element={<CandidateLoginPage />} />
    <Route path="/candidate/forgot-password" element={<CandidateForgotPasswordPage />} />
    <Route path="/candidate/reset-password" element={<CandidateResetPasswordPage />} />
    <Route element={<CandidateProtectedRoute />}>
      <Route path="/candidate/change-password" element={<CandidateChangePasswordPage />} />
    </Route>
    <Route element={<CandidateProtectedRoute requirePasswordChanged />}>
      <Route element={<CandidateLayout />}>
        <Route path="/candidate/dashboard" element={<CandidateDashboardPage />} />
        <Route path="/candidate/interviews" element={<CandidateInterviewsPage />} />
        <Route path="/candidate/interviews/:interviewId" element={<CandidateInterviewOverviewPage />} />
        <Route path="/candidate/interviews/:interviewId/consent" element={<CandidateConsentPage />} />
        <Route path="/candidate/interviews/:interviewId/device-check" element={<CandidateDeviceCheckPage />} />
        <Route path="/candidate/interviews/:interviewId/instructions" element={<CandidateInterviewInstructionsPage />} />
        <Route path="/candidate/interviews/:interviewId/ready" element={<CandidateInterviewReadyPage />} />
        <Route path="/candidate/interviews/:interviewId/session" element={<CandidateAutomatedInterviewPage />} />
        <Route path="/candidate/interviews/:interviewId/submitted" element={<CandidateInterviewSubmittedPage />} />
        <Route path="/candidate/profile" element={<CandidateProfilePage />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/change-password" element={<Navigate to="/profile?tab=security" replace />} />
        <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN, ROLES.RECRUITER]} />}><Route path="/screenings/new" element={<NewScreeningPage />} /></Route>
        <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER]} />}><Route path="/job-descriptions" element={<JobDescriptionsPage />} /><Route path="/website-applications" element={<WebsiteApplicationsPage />} /><Route path="/screenings" element={<ScreeningHistoryPage />} /><Route path="/screenings/:screeningId" element={<ScreeningDetailPage />} /></Route>
        <Route element={<RoleRoute allowedRoles={allRoles} />}><Route path="/interviews" element={<InterviewDashboardPage />} /><Route path="/interviews/:interviewId" element={<InterviewWorkspacePage />} /></Route>
        <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}><Route path="/team" element={<UserManagementPage />} /><Route path="/organization" element={<OrganizationSettingsPage />} /></Route>
      </Route>
    </Route>

    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}
