import { useState, useEffect } from 'react';
import SignUp from './components/SignUp';
import SignIn from './components/SignIn';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Check if user is already logged in (session only, no localStorage)
    const sessionToken = sessionStorage.getItem('token');
    const sessionUser = sessionStorage.getItem('user');
    
    if (sessionToken && sessionUser) {
      try {
        setUser(JSON.parse(sessionUser));
        setToken(sessionToken);
        setIsAuthenticated(true);
      } catch (error) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      }
    }
  }, []);

  const handleSignUp = (data) => {
    setUser(data.user);
    setToken(data.token);
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    setIsAuthenticated(true);
  };

  const handleSignIn = (data) => {
    setUser(data.user);
    setToken(data.token);
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setShowSignUp(false);
  };

  if (isAuthenticated && user && token) {
    return <Dashboard user={user} token={token} onLogout={handleLogout} />;
  }

  return (
    <div className="app">
      {showSignUp ? (
        <SignUp
          onSignUp={handleSignUp}
          switchToSignIn={() => setShowSignUp(false)}
        />
      ) : (
        <SignIn
          onSignIn={handleSignIn}
          switchToSignUp={() => setShowSignUp(true)}
        />
      )}
    </div>
  );
}

export default App;
