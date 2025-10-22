import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function Header() {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('token');
  const userId = localStorage.getItem('user_id');

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      navigate('/login');
    }
  };

  return (
    <header className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold">중앙 도서 관리 시스템</h1>
            {isAuthenticated && (
              <nav className="flex space-x-4">
                <Link
                  to="/books"
                  className="hover:text-blue-200 transition-colors"
                >
                  도서 목록
                </Link>
                <Link
                  to="/cart"
                  className="hover:text-blue-200 transition-colors"
                >
                  장바구니
                </Link>
              </nav>
            )}
          </div>
          {isAuthenticated && (
            <div className="flex items-center space-x-4">
              <span className="text-sm">환영합니다, {userId}님</span>
              <button
                onClick={handleLogout}
                className="bg-blue-500 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
