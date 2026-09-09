import { Request, Response, NextFunction } from 'express';
import { supabaseServer } from '../lib/supabase-server.ts';

export interface AuthRequest extends Request {
  user?: { role: 'admin'; username: string; id: string };
}

function getBearerToken(req: Request) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized: Supabase session required' });
    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Unauthorized: Invalid or expired Supabase session' });
    req.user = { role: 'admin', username: String(data.user.user_metadata?.username || 'admin'), id: data.user.id };
    next();
  } catch (error) {
    console.error('Supabase auth middleware error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid Supabase session' });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    if (token) {
      const { data } = await supabaseServer.auth.getUser(token);
      if (data.user) req.user = { role: 'admin', username: String(data.user.user_metadata?.username || 'admin'), id: data.user.id };
    }
  } catch {}
  next();
};
