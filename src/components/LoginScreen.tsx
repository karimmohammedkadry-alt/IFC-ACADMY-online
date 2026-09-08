import React, { useState } from 'react';
import { User, KeyRound, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { IFCLogo } from './IFCLogo';

interface LoginScreenProps {
  onLogin: (user: { name: string; role: string; avatar: string; email?: string; username?: string }, token: string, refreshToken?: string, expiresAt?: number, password?: string) => void;
  authenticate: (username: string, password: string) => Promise<{ token: string; access_token?: string; refresh_token?: string; expires_at?: number; user: { name: string; role: string; avatar: string; username: string } }>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, authenticate }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    try {
      const result = await authenticate(username.trim(), password);
      onLogin(result.user, result.access_token || result.token, result.refresh_token, result.expires_at, password);
    } catch (error: any) {
      setErrorMessage(error?.message || 'بيانات الدخول غير صحيحة. يرجى التحقق من اسم المستخدم وكلمة المرور.');
    }
  };

  return (
    <div
      id="page-login"
      className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6"
      dir="ltr"
    >
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-black/60 border border-yellow-500/20 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-2xl animate-fadeIn">
        {/* Left Side: Official IFC Logo */}
        <div className="flex flex-col items-center justify-center text-center p-4 lg:p-6 lg:border-r border-white/10">
          <div className="relative group">
            <div className="absolute inset-0 rounded-full bg-yellow-500/20 blur-2xl group-hover:bg-yellow-500/30 transition-all duration-500" />
            <IFCLogo
              size="2xl"
              withGlow
              className="w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 drop-shadow-[0_0_35px_rgba(250,204,21,0.35)]"
            />
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider font-sans">
              IFC <span className="text-yellow-400">ACADEMY</span>
            </h1>
          </div>
        </div>

        {/* Right Side: Clean Login Form */}
        <div className="w-full max-w-md mx-auto" dir="ltr">
          <div className="mb-6 text-left">
            <h2 className="text-3xl font-black text-yellow-400 tracking-wider uppercase font-sans">
              LOGIN
            </h2>
          </div>

          {errorMessage && (
            <div
              className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn"
              dir="rtl"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left" autoComplete="off">
            <div>
              <label htmlFor="login-username" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4 text-yellow-400/80" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="off"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full bg-white/[0.04] border border-white/15 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-hidden text-slate-100 text-sm rounded-xl py-3 pl-10 pr-3 backdrop-blur-md transition-all font-mono"
                  placeholder=""
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4 text-yellow-400/80" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full bg-white/[0.04] border border-white/15 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-hidden text-slate-100 text-sm rounded-xl py-3 pl-10 pr-10 backdrop-blur-md transition-all font-mono"
                  placeholder=""
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-yellow-400 cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* LOGIN NOW Button */}
            <button
              type="submit"
              id="btn-submit-login"
              className="w-full py-3.5 px-4 rounded-xl text-sm font-black tracking-wider uppercase text-yellow-400 bg-transparent border-2 border-yellow-400 hover:bg-yellow-400 hover:text-black shadow-lg shadow-yellow-400/20 transition-all duration-300 cursor-pointer active:scale-98 mt-3"
            >
              LOGIN NOW
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
