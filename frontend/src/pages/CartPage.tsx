import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { cartAPI } from '../services/api';
import type { CartItem } from '../types';

export default function CartPage() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      setLoading(true);
      const data = await cartAPI.getCart();
      setCartItems(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '장바구니를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (bookId: string) => {
    if (!confirm('이 도서를 장바구니에서 제거하시겠습니까?')) {
      return;
    }

    try {
      await cartAPI.removeFromCart(bookId);
      await loadCart();
      // 장바구니 업데이트 이벤트 발생
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (err: any) {
      alert(err.response?.data?.error || '제거에 실패했습니다.');
    }
  };

  const handleClear = async () => {
    if (!confirm('장바구니를 비우시겠습니까?')) {
      return;
    }

    try {
      await cartAPI.clearCart();
      await loadCart();
      // 장바구니 업데이트 이벤트 발생
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (err: any) {
      alert(err.response?.data?.error || '장바구니 비우기에 실패했습니다.');
    }
  };

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">장바구니</h2>
            <p className="text-gray-600 mt-2">
              선택한 도서를 확인하세요. (총 {cartItems.length}권)
            </p>
          </div>
          <button
            onClick={() => navigate('/books')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            도서 추가하기
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">로딩 중...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            {error}
          </div>
        ) : cartItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-24 h-24 mx-auto mb-4 text-gray-300"
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
            <p className="text-gray-600 text-lg mb-4">
              장바구니가 비어있습니다.
            </p>
            <button
              onClick={() => navigate('/books')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              도서 둘러보기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.book_id}
                className="bg-white rounded-lg shadow-md p-6 flex items-center space-x-6"
              >
                <div className="w-24 h-32 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center">
                  {item.cover_image ? (
                    <img
                      src={item.cover_image}
                      alt={item.title}
                      className="h-full w-full object-cover rounded"
                    />
                  ) : (
                    <svg
                      className="w-12 h-12 text-gray-400"
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
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{item.author}</p>
                  <p className="text-blue-600 font-medium">
                    {item.price.toLocaleString()}원 x {item.quantity}권
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-800 mb-3">
                    {(item.price * item.quantity).toLocaleString()}원
                  </p>
                  <button
                    onClick={() => handleRemove(item.book_id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    제거
                  </button>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xl font-bold text-gray-800">
                  총 결제 금액
                </span>
                <span className="text-3xl font-bold text-blue-600">
                  {totalPrice.toLocaleString()}원
                </span>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={handleClear}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  장바구니 비우기
                </button>
                <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                  구매하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
