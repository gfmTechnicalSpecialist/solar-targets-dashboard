import React, { useState } from 'react';
import { Sun, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Moon } from 'lucide-react';

const SignIn: React.FC = () => {
  const { signIn, sessionError, clearSessionError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearSessionError();

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    const result = await signIn(username, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Sign in failed.');
    }
  };

  return (
    <div className="signin-page">
      <button
        className="signin-theme-toggle"
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="signin-card">
        <div className="signin-header">
          <div className="signin-logo">m</div>
          <h1>Momentum Group Solar Dashboard</h1>
          <p>Sign in to access executive solar performance insights</p>
        </div>

        <form className="signin-form" onSubmit={handleSubmit}>
          {(error || sessionError) && (
            <div className="signin-error">
              <AlertCircle size={16} />
              {error || sessionError}
            </div>
          )}

          <div className="signin-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="signin-field">
            <label htmlFor="password">Password</label>
            <div className="signin-password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="signin-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="signin-submit" disabled={loading}>
            {loading ? (
              <span className="signin-spinner" />
            ) : (
              <LogIn size={18} />
            )}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignIn;
