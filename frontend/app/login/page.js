'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Public demo account. Seeded by scripts/seed-demo.js — keep these in sync.
const DEMO_EMAIL = 'demo@applai.dev';
const DEMO_PASSWORD = 'demo1234';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async (email, password) => {
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    setLoading(false);

    if (result?.error) {
      setError(email === DEMO_EMAIL ? 'Demo account is unavailable right now.' : 'Invalid email or password');
    } else {
      router.push('/');
      router.refresh();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    login(email, password);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🎯</div>
          <h1>Internship Hunt</h1>
          <p>AI-powered job matching & resume tailoring</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <button
            type="button"
            className="btn auth-submit auth-demo"
            onClick={() => login(DEMO_EMAIL, DEMO_PASSWORD)}
            disabled={loading}
          >
            👀 Explore the demo — no signup
          </button>
          <p className="auth-demo-note">
            Signs you into a sample account with pre-scored jobs and resumes.
          </p>
        </form>

        <div className="auth-footer">
          Don&apos;t have an account?{' '}
          <a href="/signup">Create one</a>
        </div>
      </div>
    </div>
  );
}
