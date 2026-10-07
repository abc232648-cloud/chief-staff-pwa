import { FormEvent, useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';

export function LoginScreen() {
  const { login, error, status } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const busy = status === 'checking';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const currentPassword = password;
    setPassword('');
    if (!username.trim() || !currentPassword) return;
    await login(username.trim(), currentPassword);
  };

  return (
    <main className="production-lock">
      <section className="card login-card" aria-labelledby="staff-login-title">
        <div className="brand-lockup" style={{ marginBottom: 18 }}>
          <div className="brand-mark" aria-hidden="true">C</div>
          <div>
            <div className="brand-title">CHIEF Staff</div>
            <div className="brand-subtitle">Field Operations</div>
          </div>
        </div>
        <div className="eyebrow">Secure staff access</div>
        <h1 id="staff-login-title">Sign in</h1>
        <p className="muted">Uses the existing Chief same-origin session. Passwords and session cookies are not stored by this PWA.</p>
        <form className="login-form" onSubmit={submit}>
          <label className="field-label" htmlFor="username">Username</label>
          <input
            id="username"
            className="field-input"
            autoComplete="username"
            value={username}
            onChange={event => setUsername(event.target.value)}
            disabled={busy}
          />
          <label className="field-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="field-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            disabled={busy}
          />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary-action" type="submit" disabled={busy || !username.trim() || !password}>
            <LogIn size={18} aria-hidden="true" /> {busy ? 'Checking Chief…' : 'Sign in to Chief'}
          </button>
        </form>
        <div className="auth-note"><ShieldCheck size={16} aria-hidden="true" /> Chief remains the authorization authority for every protected action.</div>
      </section>
    </main>
  );
}
