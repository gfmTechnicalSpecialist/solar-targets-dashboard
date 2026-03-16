import './App.css';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SiteProvider } from './context/SiteContext';
import Dashboard from './components/Dashboard';
import SignIn from './components/SignIn';

function AppContent() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="app">
      {isAuthenticated ? <Dashboard /> : <SignIn />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SiteProvider>
          <AppContent />
        </SiteProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
