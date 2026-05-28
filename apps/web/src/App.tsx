import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AuthLayout } from '@/pages/auth/AuthLayout';
import { AppLayout } from '@/pages/app/AppLayout';
import { LandingPage } from '@/pages/landing/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { DashboardPage } from '@/pages/app/DashboardPage';
import { ProjectsPage } from '@/pages/app/ProjectsPage';
import { DeploymentWizard } from '@/pages/app/wizard/DeploymentWizard';
import { DeploymentDetailPage } from '@/pages/app/deployments/DeploymentDetailPage';
import { ServersPage } from '@/pages/app/servers/ServersPage';
import { ServerDetailPage } from '@/pages/app/servers/ServerDetailPage';
import { BillingPage } from '@/pages/app/billing/BillingPage';
import { UpgradePage } from '@/pages/app/billing/UpgradePage';
import { SettingsLayout, SettingsIndexRedirect } from '@/pages/app/settings/SettingsLayout';
import { ProfilePage } from '@/pages/app/settings/ProfilePage';
import { OrganizationPage } from '@/pages/app/settings/OrganizationPage';
import { ApiKeysPage } from '@/pages/app/settings/ApiKeysPage';
import { NotificationsPage } from '@/pages/app/settings/NotificationsPage';
import { DangerPage } from '@/pages/app/settings/DangerPage';
import { GitHubPage } from '@/pages/app/settings/GitHubPage';
import { PrivateRoute } from '@/routes/PrivateRoute';
import { PublicRoute } from '@/routes/PublicRoute';

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          {/* Public marketing routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>

          {/* Auth routes — redirect authenticated users to dashboard */}
          <Route element={<PublicRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            </Route>
          </Route>

          {/* Protected app routes */}
          <Route element={<PrivateRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/app/dashboard" element={<DashboardPage />} />
              <Route path="/app/projects" element={<ProjectsPage />} />
              <Route path="/app/projects/new" element={<DeploymentWizard />} />
              <Route path="/app/deployments/:id" element={<DeploymentDetailPage />} />
              <Route path="/app/servers" element={<ServersPage />} />
              <Route path="/app/servers/:serverId" element={<ServerDetailPage />} />
              <Route path="/app/billing" element={<BillingPage />} />
              <Route path="/app/billing/upgrade" element={<UpgradePage />} />
              <Route path="/app/settings" element={<SettingsLayout />}>
                <Route index element={<SettingsIndexRedirect />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="organization" element={<OrganizationPage />} />
                <Route path="github" element={<GitHubPage />} />
                <Route path="api-keys" element={<ApiKeysPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="danger" element={<DangerPage />} />
              </Route>
            </Route>
          </Route>

          {/* Legacy /dashboard → /app/dashboard */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
