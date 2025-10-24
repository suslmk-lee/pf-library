import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import BooksPage from './pages/BooksPage';
import BorrowPage from './pages/BorrowPage';
import BorrowHistoryPage from './pages/BorrowHistoryPage';
import BookDetailPage from './pages/BookDetailPage';
import ReservationsPage from './pages/ReservationsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminBorrowManagePage from './pages/AdminBorrowManagePage';
import AdminCopyManagePage from './pages/AdminCopyManagePage';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'admin') {
    return <Navigate to="/books" replace />;
  }

  return children;
}

function App() {
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
        path="/books/:id"
        element={
          <ProtectedRoute>
            <BookDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/borrows"
        element={
          <ProtectedRoute>
            <BorrowPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/borrows/history"
        element={
          <ProtectedRoute>
            <BorrowHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservations"
        element={
          <ProtectedRoute>
            <ReservationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <AdminRoute>
            <AdminDashboardPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/borrow-manage"
        element={
          <AdminRoute>
            <AdminBorrowManagePage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/copy-manage"
        element={
          <AdminRoute>
            <AdminCopyManagePage />
          </AdminRoute>
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
