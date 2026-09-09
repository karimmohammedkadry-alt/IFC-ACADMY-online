import type express from 'express';
import { supabaseServer } from '../lib/supabase-server.ts';
export type AuthRequest=express.Request & {user?:any};
export async function requireAuth(req:AuthRequest,res:express.Response,next:express.NextFunction){
 const h=String(req.headers.authorization||''); const token=h.startsWith('Bearer ')?h.slice(7):'';
 if(!token)return res.status(401).json({error:'جلسة الدخول غير صالحة.'});
 try{const {data,error}=await supabaseServer.auth.getUser(token);if(error||!data.user)return res.status(401).json({error:'جلسة الدخول غير صالحة أو انتهت.'});req.user=data.user;next();}
 catch{return res.status(401).json({error:'جلسة الدخول غير صالحة أو انتهت.'});}
}
