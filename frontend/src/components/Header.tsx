import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authAPI, borrowAPI } from '../services/api';
import NotificationDropdown from './NotificationDropdown';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem('token');
  const userId = localStorage.getItem('user_id');
  const role = localStorage.getItem('role');
  const isAdmin = role === 'admin';
  const [cartCount, setCartCount] = useState(0);

  // 대여 개수 로드
  useEffect(() => {
    if (isAuthenticated) {
      loadCartCount();
    }

    // 대여 목록 업데이트 이벤트 리스너
    const handleBorrowUpdate = () => {
      loadCartCount();
    };
    window.addEventListener('borrowUpdated', handleBorrowUpdate);

    return () => {
      window.removeEventListener('borrowUpdated', handleBorrowUpdate);
    };
  }, [isAuthenticated, location]);

  const loadCartCount = async () => {
    try {
      const items = await borrowAPI.getBorrows();
      setCartCount(items.length);
    } catch (error) {
      console.error('Failed to load borrow count:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('role');
      navigate('/login');
    }
  };

  return (
    <header className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold">국립 중앙 도서관</h1>
            {isAuthenticated && (
              <nav className="flex space-x-4">
                <Link
                  to="/books"
                  className="hover:text-blue-200 transition-colors"
                >
                  도서 검색
                </Link>
                {!isAdmin && (
                  <>
                    <Link
                      to="/borrows"
                      className="hover:text-blue-200 transition-colors"
                    >
                      내 대여 목록
                    </Link>
                    <Link
                      to="/borrows/history"
                      className="hover:text-blue-200 transition-colors"
                    >
                      대여 이력
                    </Link>
                    <Link
                      to="/reservations"
                      className="hover:text-blue-200 transition-colors"
                    >
                      내 예약 목록
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <>
                    <Link
                      to="/admin/dashboard"
                      className="hover:text-blue-200 transition-colors"
                    >
                      대시보드
                    </Link>
                    <Link
                      to="/admin/borrow-manage"
                      className="hover:text-blue-200 transition-colors"
                    >
                      대여 관리
                    </Link>
                    <Link
                      to="/admin/copy-manage"
                      className="hover:text-blue-200 transition-colors"
                    >
                      복본 관리
                    </Link>
                  </>
                )}
              </nav>
            )}
          </div>
          {isAuthenticated && (
            <div className="flex items-center space-x-4">
              <span className="text-sm">
                환영합니다, {userId}님{isAdmin && ' (관리자)'}
              </span>

              {/* 알림 드롭다운 - 일반 사용자만 표시 */}
              {!isAdmin && <NotificationDropdown />}

              {/* 대여 목록 아이콘 - 일반 사용자만 표시 */}
              {!isAdmin && (
                <Link to="/borrows" className="relative">
                  <svg
                    className="w-6 h-6 hover:text-blue-200 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  {/* 배지 */}
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>
              )}

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
