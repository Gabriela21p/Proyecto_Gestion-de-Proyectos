// Usar rutas relativas para que Next.js las reenrute correctamente
const API_BASE = '/api';
const TOKEN_COOKIE_NAME = 'rolling_token';

function setSessionCookie(token) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export async function registerAccount(username, email, password) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
    credentials: 'include',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al registrarse');
  }

  return {
    user: data.user,
    token: data.token,
  };
}

export async function loginAccount(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al iniciar sesión');
  }

  return {
    user: data.user,
    token: data.token,
  };
}

export async function getCurrentUser(token) {
  if (!token) return null;

  const response = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.user;
}

export function saveSession(token, user) {
  localStorage.setItem('rolling_token', token);
  localStorage.setItem('rolling_user', JSON.stringify(user));
  setSessionCookie(token);
}

export function getSession() {
  if (typeof window === 'undefined') return { token: null, user: null };

  const token = localStorage.getItem('rolling_token');
  const userStr = localStorage.getItem('rolling_user');
  const user = userStr ? JSON.parse(userStr) : null;
  if (token) setSessionCookie(token);

  return { token, user };
}

export function clearSession() {
  localStorage.removeItem('rolling_token');
  localStorage.removeItem('rolling_user');
  clearSessionCookie();
}
