'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${username},name.eq.${username}`)
        .eq('password', password)
        .single();

      if (fetchError) {
        setError('Username atau password salah.');
        setIsLoggingIn(false);
      } else if (!data) {
        setError('Username atau password salah.');
        setIsLoggingIn(false);
      } else {
        login(data.role as 'manager' | 'cashier', data.name);
      }
    } catch (err: any) {
      setError('Gagal terhubung ke server. Coba lagi.');
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .login-page {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
          display: flex;
          background: #0a0a0a;
          overflow: hidden;
          position: relative;
          visibility: hidden;
          opacity: 0;
        }

        .login-page.mounted {
          visibility: visible;
          opacity: 1;
          transition: opacity 0.3s ease;
        }

        /* Ambient background glow */
        .login-page::before {
          content: '';
          position: absolute;
          top: -40%;
          left: -20%;
          width: 60%;
          height: 80%;
          background: radial-gradient(ellipse, rgba(250, 204, 21, 0.06) 0%, transparent 70%);
          pointer-events: none;
          animation: ambientFloat 12s ease-in-out infinite;
        }

        .login-page::after {
          content: '';
          position: absolute;
          bottom: -30%;
          right: -15%;
          width: 50%;
          height: 70%;
          background: radial-gradient(ellipse, rgba(250, 204, 21, 0.04) 0%, transparent 70%);
          pointer-events: none;
          animation: ambientFloat 15s ease-in-out infinite reverse;
        }

        @keyframes ambientFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }

        /* Left panel - branding */
        .brand-panel {
          display: none;
          width: 45%;
          position: relative;
          background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%);
          overflow: hidden;
          padding: 60px;
          flex-direction: column;
          justify-content: space-between;
        }

        @media (min-width: 1024px) {
          .brand-panel {
            display: flex;
          }
        }

        .brand-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(180deg, rgba(250, 204, 21, 0.03) 0%, transparent 50%, rgba(250, 204, 21, 0.02) 100%);
          pointer-events: none;
        }

        .brand-pattern {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0.03;
          background-image: radial-gradient(circle at 2px 2px, rgba(250, 204, 21, 0.5) 1px, transparent 0);
          background-size: 40px 40px;
        }

        .brand-content {
          position: relative;
          z-index: 2;
        }

        .brand-logo-container {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 80px;
        }

        .brand-logo {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(250, 204, 21, 0.2);
        }

        .brand-logo svg {
          width: 24px;
          height: 24px;
          color: #0a0a0a;
        }

        .brand-logo-text {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
        }

        .brand-headline {
          font-size: 48px;
          font-weight: 800;
          line-height: 1.1;
          color: #ffffff;
          letter-spacing: -0.03em;
          margin-bottom: 24px;
        }

        .brand-headline span {
          background: linear-gradient(135deg, #facc15 0%, #f59e0b 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .brand-description {
          font-size: 16px;
          line-height: 1.7;
          color: #737373;
          max-width: 380px;
        }

        .brand-footer {
          position: relative;
          z-index: 2;
        }

        .brand-stats {
          display: flex;
          gap: 48px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #facc15;
          letter-spacing: -0.02em;
        }

        .stat-label {
          font-size: 13px;
          color: #525252;
          font-weight: 500;
        }

        /* Right panel - login form */
        .form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          position: relative;
          z-index: 1;
        }

        .form-container {
          width: 100%;
          max-width: 400px;
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Mobile logo */
        .mobile-logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin-bottom: 48px;
        }

        @media (min-width: 1024px) {
          .mobile-logo {
            display: none;
          }
        }

        .mobile-logo-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 32px rgba(250, 204, 21, 0.25);
        }

        .mobile-logo-icon svg {
          width: 28px;
          height: 28px;
          color: #0a0a0a;
        }

        .mobile-logo-name {
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
        }

        /* Form header */
        .form-header {
          margin-bottom: 36px;
        }

        .form-header h2 {
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 8px 0;
          letter-spacing: -0.02em;
        }

        .form-header p {
          font-size: 15px;
          color: #737373;
          margin: 0;
          font-weight: 400;
        }

        /* Error message */
        .error-box {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
        }

        .error-box svg {
          width: 18px;
          height: 18px;
          color: #ef4444;
          flex-shrink: 0;
        }

        .error-box span {
          font-size: 13px;
          color: #fca5a5;
          font-weight: 500;
        }

        /* Input groups */
        .input-group {
          margin-bottom: 20px;
        }

        .input-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #a3a3a3;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 16px;
          width: 18px;
          height: 18px;
          color: #525252;
          transition: color 0.2s ease;
          pointer-events: none;
          z-index: 2;
        }

        .input-field {
          width: 100%;
          height: 52px;
          padding: 0 16px 0 48px;
          background: #141414;
          border: 1.5px solid #262626;
          border-radius: 12px;
          color: #ffffff;
          font-size: 15px;
          font-family: inherit;
          font-weight: 400;
          outline: none;
          transition: all 0.2s ease;
        }

        .input-field::placeholder {
          color: #404040;
        }

        .input-field:hover {
          border-color: #333333;
          background: #171717;
        }

        .input-field:focus {
          border-color: #facc15;
          background: #171717;
          box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.08);
        }

        .input-field:focus ~ .input-icon,
        .input-wrapper:has(.input-field:focus) .input-icon {
          color: #facc15;
        }

        .password-toggle {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          padding: 6px;
          cursor: pointer;
          color: #525252;
          transition: color 0.2s ease;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .password-toggle:hover {
          color: #a3a3a3;
        }

        .password-toggle svg {
          width: 18px;
          height: 18px;
        }

        /* Submit button */
        .submit-btn {
          width: 100%;
          height: 52px;
          margin-top: 28px;
          background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
          color: #0a0a0a;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.25s ease;
          letter-spacing: -0.01em;
        }

        .submit-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
          transition: left 0.5s ease;
        }

        .submit-btn:hover::before {
          left: 100%;
        }

        .submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(250, 204, 21, 0.3);
        }

        .submit-btn:active {
          transform: translateY(0);
          box-shadow: 0 4px 12px rgba(250, 204, 21, 0.2);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .submit-btn:disabled:hover {
          box-shadow: none;
        }

        .submit-btn:disabled::before {
          display: none;
        }

        .btn-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          position: relative;
          z-index: 1;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(10, 10, 10, 0.3);
          border-top-color: #0a0a0a;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Divider */
        .divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 32px 0 24px;
        }

        .divider-line {
          flex: 1;
          height: 1px;
          background: #1f1f1f;
        }

        .divider-text {
          font-size: 12px;
          color: #404040;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 500;
        }

        /* Quick login buttons */
        .quick-logins {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .quick-btn {
          padding: 14px 16px;
          background: #141414;
          border: 1.5px solid #1f1f1f;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          font-family: inherit;
        }

        .quick-btn:hover {
          border-color: #333333;
          background: #1a1a1a;
          transform: translateY(-1px);
        }

        .quick-btn-role {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .quick-btn-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .quick-btn-dot.manager {
          background: #facc15;
          box-shadow: 0 0 8px rgba(250, 204, 21, 0.4);
        }

        .quick-btn-dot.cashier {
          background: #22c55e;
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
        }

        .quick-btn-title {
          font-size: 13px;
          font-weight: 600;
          color: #d4d4d4;
        }

        .quick-btn-creds {
          font-size: 11px;
          color: #525252;
          font-weight: 400;
          margin-left: 16px;
        }

        /* Footer */
        .form-footer {
          text-align: center;
          margin-top: 40px;
          font-size: 12px;
          color: #333333;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <div className={`login-page ${mounted ? 'mounted' : ''}`} style={{ minHeight: '100vh', display: 'flex', background: '#0a0a0a', overflow: 'hidden' }}>
        {/* Left branding panel */}
        <div className="brand-panel" style={{ overflow: 'hidden' }}>
          <div className="brand-pattern" />
          <div className="brand-content">
            <div className="brand-logo-container">
              <div className="brand-logo" style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
                  <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                  <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                  <line x1="6" y1="2" x2="6" y2="4" />
                  <line x1="10" y1="2" x2="10" y2="4" />
                  <line x1="14" y1="2" x2="14" y2="4" />
                </svg>
              </div>
              <span className="brand-logo-text">Samba Cafe</span>
            </div>

            <h1 className="brand-headline">
              Kelola bisnis<br />
              kafe Anda<br />
              dengan <span>mudah</span>.
            </h1>
            <p className="brand-description">
              Sistem POS modern yang dirancang untuk membantu Anda mengelola pesanan, stok, dan laporan keuangan dalam satu platform terintegrasi.
            </p>
          </div>

          <div className="brand-footer">
            <div className="brand-stats">
              <div className="stat-item">
                <span className="stat-value">99.9%</span>
                <span className="stat-label">Uptime</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">&lt;1s</span>
                <span className="stat-label">Response</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">24/7</span>
                <span className="stat-label">Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="form-panel">
          <div className="form-container">
            {/* Mobile logo */}
            <div className="mobile-logo">
              <div className="mobile-logo-icon" style={{ width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px' }}>
                  <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                  <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                  <line x1="6" y1="2" x2="6" y2="4" />
                  <line x1="10" y1="2" x2="10" y2="4" />
                  <line x1="14" y1="2" x2="14" y2="4" />
                </svg>
              </div>
              <span className="mobile-logo-name">Samba Cafe</span>
            </div>

            {/* Form header */}
            <div className="form-header">
              <h2>Selamat datang</h2>
              <p>Masuk ke akun Anda untuk melanjutkan</p>
            </div>

            {/* Error */}
            {error && (
              <div className="error-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label className="input-label">Username</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    required
                    placeholder="Masukkan username"
                    className="input-field"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Masukkan password"
                    className="input-field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    style={{ paddingRight: '48px' }}
                  />
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={isLoggingIn}
              >
                <div className="btn-content">
                  {isLoggingIn ? (
                    <>
                      <div className="spinner" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </div>
              </button>
            </form>

            {/* Quick login */}
            <div className="divider">
              <div className="divider-line" />
              <span className="divider-text">Demo Login</span>
              <div className="divider-line" />
            </div>

            <div className="quick-logins">
              <button
                type="button"
                className="quick-btn"
                onClick={() => {
                  setUsername('manager');
                  setPassword('admin123');
                }}
              >
                <div className="quick-btn-role">
                  <div className="quick-btn-dot manager" />
                  <span className="quick-btn-title">Manager</span>
                </div>
                <div className="quick-btn-creds">manager / admin123</div>
              </button>
              <button
                type="button"
                className="quick-btn"
                onClick={() => {
                  setUsername('sheera');
                  setPassword('password123');
                }}
              >
                <div className="quick-btn-role">
                  <div className="quick-btn-dot cashier" />
                  <span className="quick-btn-title">Cashier</span>
                </div>
                <div className="quick-btn-creds">sheera / password123</div>
              </button>
            </div>

            <div className="form-footer">
              © 2026 Samba Cafe POS. All rights reserved.
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
