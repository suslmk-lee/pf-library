import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { borrowAPI, bookAPI } from '../services/api';
import type { BorrowItem, Book } from '../types';

export default function AdminBorrowManagePage() {
  const navigate = useNavigate();
  const [borrows, setBorrows] = useState<BorrowItem[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
      alert('관리자 권한이 필요합니다.');
      navigate('/books');
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [borrowsData, booksData] = await Promise.all([
        borrowAPI.adminGetAllBorrows(),
        bookAPI.getBooks(),
      ]);
      setBorrows(borrowsData);
      setBooks(booksData);
    } catch (err: any) {
      setError(err.response?.data?.error || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnBook = async (borrow: BorrowItem) => {
    if (!confirm(`"${borrow.title}"을(를) 반납 처리하시겠습니까?`)) {
      return;
    }

    try {
      setProcessing(true);
      await borrowAPI.adminReturnBook(borrow.id);
      alert('반납 처리가 완료되었습니다.');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || '반납 처리에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenBorrowModal = (book: Book) => {
    setSelectedBook(book);
    setTargetUserId('');
    setShowBorrowModal(true);
  };

  const handleBorrowBook = async () => {
    if (!selectedBook || !targetUserId.trim()) {
      alert('사용자 ID를 입력해주세요.');
      return;
    }

    try {
      setProcessing(true);
      await borrowAPI.adminBorrowBook(targetUserId, selectedBook);
      alert(`사용자 ${targetUserId}님에게 "${selectedBook.title}"이(가) 대여되었습니다.`);
      setShowBorrowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || '대여 등록에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">관리자 - 대여 관리</h2>
          <p className="text-gray-600 mt-2">
            현재 대여 중인 도서 목록과 신규 대여 등록을 관리합니다.
          </p>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-blue-600 mb-1">전체 대여 중</div>
            <div className="text-3xl font-bold text-blue-800">{borrows.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-red-600 mb-1">연체</div>
            <div className="text-3xl font-bold text-red-800">
              {borrows.filter((b) => isOverdue(b.due_date)).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-green-600 mb-1">보유 도서</div>
            <div className="text-3xl font-bold text-green-800">{books.length}</div>
          </div>
        </div>

        {/* 현재 대여 목록 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">현재 대여 중인 도서</h3>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="text-gray-600">로딩 중...</div>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
          ) : borrows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              현재 대여 중인 도서가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">사용자</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">도서명</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">저자</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">대여일</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">반납 예정일</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">상태</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {borrows.map((borrow) => (
                    <tr key={borrow.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-800">{borrow.user_id}</td>
                      <td className="py-3 px-4 text-gray-700">{borrow.title}</td>
                      <td className="py-3 px-4 text-gray-600">{borrow.author}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDateTime(borrow.borrowed_at)}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={
                            isOverdue(borrow.due_date)
                              ? 'text-red-600 font-medium'
                              : 'text-gray-600'
                          }
                        >
                          {formatDate(borrow.due_date)}
                          {isOverdue(borrow.due_date) && ' (연체)'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isOverdue(borrow.due_date) ? (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            연체
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            대여 중
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleReturnBook(borrow)}
                          disabled={processing}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400"
                        >
                          반납 처리
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 신규 대여 등록 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">신규 대여 등록</h3>
          <p className="text-gray-600 mb-4">도서를 선택하여 사용자에게 대여를 등록하세요.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {books.slice(0, 12).map((book) => (
              <div key={book.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                <h4 className="font-bold text-gray-800 mb-1 line-clamp-1">{book.title}</h4>
                <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                <button
                  onClick={() => handleOpenBorrowModal(book)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  대여 등록
                </button>
              </div>
            ))}
          </div>
          {books.length > 12 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => navigate('/books')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                전체 도서 보기 →
              </button>
            </div>
          )}
        </div>

        {/* 대여 등록 모달 */}
        {showBorrowModal && selectedBook && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">대여 등록</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">도서</p>
                <p className="font-bold text-gray-800">{selectedBook.title}</p>
                <p className="text-sm text-gray-600">{selectedBook.author}</p>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사용자 ID
                </label>
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="예: user"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBorrowModal(false)}
                  disabled={processing}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:bg-gray-300"
                >
                  취소
                </button>
                <button
                  onClick={handleBorrowBook}
                  disabled={processing || !targetUserId.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400"
                >
                  {processing ? '처리 중...' : '대여 등록'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
