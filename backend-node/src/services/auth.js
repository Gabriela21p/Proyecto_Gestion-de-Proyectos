import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

import { config } from '../config.js';
import { query } from '../db/postgres.js';

const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

export async function registerUser({ username, email, password }) {
  const normalizedUsername = normalizeUsername(username || email);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password || password.length < 8) {
    throw new Error('Email y password de al menos 8 caracteres son obligatorios');
  }

  if (supabase) {
    await supabase.auth.signUp({ email: normalizedEmail, password });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    `
      INSERT INTO users(username, email, password_hash, auth_provider, email_verified, identity_level, reputation, review_weight)
      VALUES($1, $2, $3, 'local', false, 'registered', 10, 1.25)
      ON CONFLICT(email) DO UPDATE SET updated_at = now()
      RETURNING id, username, email, role, reputation, email_verified, identity_level, review_weight, created_at
    `,
    [normalizedUsername, normalizedEmail, passwordHash]
  );
  return result.rows[0];
}

export async function loginUser({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
  const user = result.rows[0];
  if (!user || !user.password_hash) throw new Error('Credenciales invalidas');

  const valid = await bcrypt.compare(password || '', user.password_hash);
  if (!valid) throw new Error('Credenciales invalidas');

  const token = signToken(user);
  return { token, user: toAuthUser(user) };
}

export async function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: config.jwtIssuer });
    const result = await query('SELECT * FROM users WHERE id = $1', [payload.sub]);
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

export async function requireUser(request, reply) {
  const header = request.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = await verifyToken(token);
  if (!user) {
    reply.code(401).send({ error: 'Debes iniciar sesion' });
    return null;
  }
  return user;
}

export async function requireRole(request, reply, roles = []) {
  const user = await requireUser(request, reply);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    reply.code(403).send({ error: 'No tienes permisos para esta accion' });
    return null;
  }
  return user;
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      identity_level: user.identity_level
    },
    config.jwtSecret,
    { expiresIn: '14d', issuer: config.jwtIssuer }
  );
}

export function toAuthUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    reputation: user.reputation,
    email_verified: user.email_verified,
    identity_level: user.identity_level,
    review_weight: Number(user.review_weight || 1)
  };
}

export function normalizeUsername(value) {
  return String(value || 'vecino')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || `vecino_${Date.now()}`;
}
