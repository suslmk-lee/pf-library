import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authAPI, cartAPI } from '../services/api';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem('token');
  const userId = localStorage.getItem('user_id');
  const [cartCount, setCartCount] = useState(0);

  // 장바구니 개수 로드
  useEffect(() => {
    if (isAuthenticated) {
      loadCartCount();
    }

    // 장바구니 업데이트 이벤트 리스너
    const handleCartUpdate = () => {
      loadCartCount();
    };
    window.addEventListener('cartUpdated', handleCartUpdate);

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, [isAuthenticated, location]);

  const loadCartCount = async () => {
    try {
      const items = await cartAPI.getCart();
      const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(totalCount);
    } catch (error) {
      console.error('Failed to load cart count:', error);
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

              {/* 장바구니 아이콘 */}
              <Link to="/cart" className="relative">
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
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                {/* 배지 */}
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>

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
