import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { borrowAPI } from '../services/api';
import type { BorrowItem } from '../types';

export default function BorrowPage() {
  const navigate = useNavigate();
  const [borrowItems, setBorrowItems] = useState<BorrowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBorrows();
  }, []);

  const loadBorrows = async () => {
    try {
      setLoading(true);
      const data = await borrowAPI.getBorrows();
      setBorrowItems(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '대여 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (bookId: string) => {
    if (!confirm('이 도서를 반납하시겠습니까?')) {
      return;
    }

    try {
      await borrowAPI.returnBook(bookId);
      await loadBorrows();
      window.dispatchEvent(new Event('borrowUpdated'));
      alert('도서가 반납되었습니다.');
    } catch (err: any) {
      alert(err.response?.data?.error || '반납에 실패했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">내 대여 목록</h2>
            <p className="text-gray-600 mt-2">
              현재 대여 중인 도서 목록입니다. (총 {borrowItems.length}권)
            </p>
          </div>
          <button
            onClick={() => navigate('/books')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            도서 검색하기
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
        ) : borrowItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-400"
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
            <p className="text-gray-600 mb-4">대여 중인 도서가 없습니다.</p>
            <button
              onClick={() => navigate('/books')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              도서 검색하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {borrowItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 mb-2">{item.author}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>대여일: {formatDate(item.borrowed_at)}</span>
                      <span className={isOverdue(item.due_date) ? 'text-red-600 font-bold' : ''}>
                        반납 예정일: {item.due_date}
                        {isOverdue(item.due_date) && ' (연체)'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleReturn(item.book_id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors ml-4"
                  >
                    반납하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
