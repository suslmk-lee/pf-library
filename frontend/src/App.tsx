import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import BooksPage from './pages/BooksPage';
import CartPage from './pages/CartPage';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/books"
        element={
          <ProtectedRoute>
            <BooksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cart"
        element={
          <ProtectedRoute>
            <CartPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          isAuthenticated ? <Navigate to="/books" replace /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}

export default App;
