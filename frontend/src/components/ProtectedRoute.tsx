import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getUser } from '../lib/auth';
import { EmptyState } from './EmptyState';
import type { Role } from '../types';

interface Props {
  allowedRoles: Role[];
  children: ReactNode;
}

const LockIcon = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export function ProtectedRoute({ allowedRoles, children }: Props) {
  const user = getUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <EmptyState
        icon={LockIcon}
        title="Sin acceso a esta sección"
        description="No tienes permiso para ver esta sección. Si crees que es un error, contacta al administrador de la clínica."
      />
    );
  }

  return <>{children}</>;
}
