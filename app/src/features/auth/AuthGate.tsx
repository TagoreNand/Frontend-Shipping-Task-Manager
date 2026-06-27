import type { ReactNode } from 'react';
import { requiresAuth, useAuthStore } from './authStore';
import { LoginScreen } from './LoginScreen';

/** Gates its children behind a login screen when running against the backend. */
export function AuthGate({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  if (requiresAuth && !token) {
    return <LoginScreen />;
  }
  return <>{children}</>;
}
