// src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { sendError } from '../lib/http';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

const SALT_ROUNDS = 12;
const TOKEN_TTL = '7d';

function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, display_name } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, created_at`,
      [email.toLowerCase().trim(), hash, display_name ?? null]
    );
    const user = result.rows[0];
    const token = signToken(user.id, user.email);
    res.status(201).json({ token, user: { id: user.id, email: user.email, display_name: user.display_name } });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'An account with that email already exists' });
    } else {
      sendError(res, err, 'Auth');
    }
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken(user.id, user.email);
    res.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name } });
  } catch (err) {
    sendError(res, err, 'Auth');
  }
});

// GET /api/auth/me  (requires token)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'Auth');
  }
});

export default router;
