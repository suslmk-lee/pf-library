import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import BooksPage from './pages/BooksPage';
import CartPage from './pages/CartPage';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/books"
        element={isAuthenticated ? <BooksPage /> : <Navigate to="/login" />}
      />
      <Route
        path="/cart"
        element={isAuthenticated ? <CartPage /> : <Navigate to="/login" />}
      />
      <Route path="/" element={<Navigate to="/books" />} />
    </Routes>
  );
}

export default App;
