import type { AuthUser } from '../types';

let authToken: string | null = null;
let authUser: AuthUser | null = null;

export function setAuth(token: string, user: AuthUser) {
  authToken = token;
  authUser = user;
}

export function clearAuth() {
  authToken = null;
  authUser = null;
}

export function getToken() {
  return authToken;
}

export function getUser() {
  return authUser;
}

export function isAuthenticated() {
  return authToken !== null && authUser !== null;
}
