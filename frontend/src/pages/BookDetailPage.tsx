import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { bookAPI, reservationAPI } from '../services/api';
import type { Book } from '../types';

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const userId = localStorage.getItem('user_id');
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (id) {
      loadBook(id);
    }
  }, [id]);

  const loadBook = async (bookId: string) => {
    try {
      setLoading(true);
      const data = await bookAPI.getBook(bookId);
      setBook(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '도서 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async () => {
    if (!userId || !id) return;

    try {
      await reservationAPI.createReservation(userId, id);
      setSuccess('도서가 예약되었습니다. 도서가 반납되면 알림을 보내드립니다.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || '예약에 실패했습니다.');
      setTimeout(() => setError(''), 5000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">로딩 중...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
            {error || '도서를 찾을 수 없습니다.'}
          </div>
          <button
            onClick={() => navigate('/books')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            도서 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/books')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          도서 목록으로 돌아가기
        </button>

        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-4">{success}</div>
        )}

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="md:flex">
            {/* 도서 이미지 */}
            <div className="md:w-1/3 bg-gray-200 flex items-center justify-center p-8">
              {book.cover_image ? (
                <img
                  src={book.cover_image}
                  alt={book.title}
                  className="max-h-96 w-full object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-gray-400 text-center">
                  <svg
                    className="w-32 h-32 mx-auto mb-4"
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
                  <span className="text-lg">이미지 없음</span>
                </div>
              )}
            </div>

            {/* 도서 정보 */}
            <div className="md:w-2/3 p-8">
              <div className="mb-6">
                <h1 className="text-4xl font-bold text-gray-800 mb-3">{book.title}</h1>
                <p className="text-xl text-gray-600 mb-2">{book.author}</p>
                <p className="text-lg text-gray-500">
                  {book.publisher} • {book.year}
                </p>
              </div>

              <div className="border-t border-b py-6 mb-6 space-y-3">
                <div className="flex">
                  <span className="font-semibold text-gray-700 w-24">ISBN:</span>
                  <span className="text-gray-600">{book.isbn}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold text-gray-700 w-24">저자:</span>
                  <span className="text-gray-600">{book.author}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold text-gray-700 w-24">출판사:</span>
                  <span className="text-gray-600">{book.publisher}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold text-gray-700 w-24">출판연도:</span>
                  <span className="text-gray-600">{book.year}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold text-gray-700 w-24">소장:</span>
                  <span className="text-gray-600">
                    전체 {book.total_copies}권 / 대여 가능 {book.available_copies}권
                  </span>
                </div>
                <div className="flex">
                  <span className="font-semibold text-gray-700 w-24">대여 상태:</span>
                  {book.available_copies > 0 ? (
                    <span className="text-green-600 font-medium">대여 가능</span>
                  ) : (
                    <span className="text-red-600 font-medium">대여 불가 (모두 대여 중)</span>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">도서 소개</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {book.description}
                </p>
              </div>

              {/* 예약 버튼 - 일반 사용자이고 도서가 모두 대여 중일 때만 표시 */}
              {role !== 'admin' && book.available_copies === 0 && (
                <div className="mb-6">
                  <button
                    onClick={handleReserve}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    도서 예약하기
                  </button>
                  <p className="text-sm text-gray-600 mt-2 text-center">
                    도서가 반납되면 알림을 보내드립니다
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-blue-900 mb-3">대여 안내</h3>
                <ul className="space-y-2 text-blue-800">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>도서관 방문 시 회원카드를 지참하세요</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>대여 기간은 14일이며, 1회 연장 가능합니다</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>대여는 도서관 카운터에서 진행됩니다</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>연체 시 연체일수만큼 대여가 제한됩니다</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
