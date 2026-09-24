const API_BASE = '/api';
const TOKEN_COOKIE_NAME = 'rolling_token';
const TOKEN_STORAGE_KEY = 'rolling_token';
const USER_STORAGE_KEY = 'rolling_user';

// Mantenemos una cookie corta para el middleware y localStorage para hidratar
// el cliente sin pedirle al usuario que inicie sesión en cada recarga.
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
  // Todas las llamadas pasan por /api para aprovechar el proxy de Next.
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
  // Guardamos token y usuario juntos; una sesión a medias se considera inválida.
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  setSessionCookie(token);
}

export function getSession() {
  if (typeof window === 'undefined') return { token: null, user: null };

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const userStr = localStorage.getItem(USER_STORAGE_KEY);
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch {
    clearSession();
    return { token: null, user: null };
  }

  if (token) setSessionCookie(token);

  return { token, user };
}

export function clearSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  clearSessionCookie();
}
