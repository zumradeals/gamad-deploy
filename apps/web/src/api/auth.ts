import { apiRequest } from './client';

export interface AuthResult {
  token: string;
  orgId: string;
  userId: string;
}

export function register(fullName: string, email: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
  });
}

export function login(email: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
