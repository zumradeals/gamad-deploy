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
              {/* Placeholder routes for future phases */}
              <Route path="/app/servers" element={<Navigate to="/app/dashboard" replace />} />
              <Route path="/app/billing" element={<Navigate to="/app/dashboard" replace />} />
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
