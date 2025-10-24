import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { bookAPI } from '../services/api';
import type { Book } from '../types';

interface CopyWithBook {
  id: number;
  book_id: string;
  copy_number: number;
  status: 'available' | 'borrowed' | 'maintenance' | 'lost';
  location: string;
  acquired_date: string;
  notes: string;
  book_title: string;
  book_author: string;
}

export default function AdminCopyManagePage() {
  const [copies, setCopies] = useState<CopyWithBook[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterBookId, setFilterBookId] = useState('');
  const [editingCopy, setEditingCopy] = useState<CopyWithBook | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterBookId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [copiesData, booksData] = await Promise.all([
        bookAPI.adminGetAllCopies(filterBookId || undefined),
        bookAPI.getBooks(),
      ]);
      setCopies(copiesData);
      setBooks(booksData);
    } catch (err: any) {
      setError(err.response?.data?.error || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCopy = async (copy: CopyWithBook) => {
    try {
      await bookAPI.adminUpdateCopy(copy.id, {
        status: copy.status,
        location: copy.location,
        acquired_date: copy.acquired_date,
        notes: copy.notes,
      });
      setSuccess('복본이 수정되었습니다.');
      setEditingCopy(null);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '복본 수정에 실패했습니다.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteCopy = async (id: number) => {
    if (!confirm('정말 이 복본을 삭제하시겠습니까?')) return;

    try {
      await bookAPI.adminDeleteCopy(id);
      setSuccess('복본이 삭제되었습니다.');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '복본 삭제에 실패했습니다.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAddCopy = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await bookAPI.adminAddCopy({
        book_id: formData.get('book_id') as string,
        copy_number: parseInt(formData.get('copy_number') as string),
        status: formData.get('status') as string,
        location: formData.get('location') as string,
        acquired_date: formData.get('acquired_date') as string,
        notes: formData.get('notes') as string,
      });
      setSuccess('복본이 추가되었습니다.');
      setShowAddModal(false);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '복본 추가에 실패했습니다.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'borrowed':
        return 'bg-blue-100 text-blue-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return '대여 가능';
      case 'borrowed':
        return '대여 중';
      case 'maintenance':
        return '정비 중';
      case 'lost':
        return '분실';
      default:
        return status;
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

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">복본 관리</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            + 복본 추가
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-4">{success}</div>
        )}

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            도서로 필터
          </label>
          <select
            value={filterBookId}
            onChange={(e) => setFilterBookId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 도서</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title} - {book.author}
              </option>
            ))}
          </select>
        </div>

        {/* 복본 테이블 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    도서 정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    복본번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    위치
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    입수일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    비고
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {copies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      복본이 없습니다.
                    </td>
                  </tr>
                ) : (
                  copies.map((copy) => (
                    <tr key={copy.id} className="hover:bg-gray-50">
                      {editingCopy?.id === copy.id ? (
                        <>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {copy.book_title}
                            </div>
                            <div className="text-sm text-gray-500">{copy.book_author}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {copy.copy_number}
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={editingCopy.status}
                              onChange={(e) =>
                                setEditingCopy({
                                  ...editingCopy,
                                  status: e.target.value as any,
                                })
                              }
                              className="px-2 py-1 border rounded"
                            >
                              <option value="available">대여 가능</option>
                              <option value="borrowed">대여 중</option>
                              <option value="maintenance">정비 중</option>
                              <option value="lost">분실</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editingCopy.location}
                              onChange={(e) =>
                                setEditingCopy({ ...editingCopy, location: e.target.value })
                              }
                              className="px-2 py-1 border rounded w-full"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="date"
                              value={editingCopy.acquired_date}
                              onChange={(e) =>
                                setEditingCopy({
                                  ...editingCopy,
                                  acquired_date: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editingCopy.notes}
                              onChange={(e) =>
                                setEditingCopy({ ...editingCopy, notes: e.target.value })
                              }
                              className="px-2 py-1 border rounded w-full"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => handleUpdateCopy(editingCopy)}
                              className="text-green-600 hover:text-green-900 mr-3"
                            >
                              저장
                            </button>
                            <button
                              onClick={() => setEditingCopy(null)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              취소
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {copy.book_title}
                            </div>
                            <div className="text-sm text-gray-500">{copy.book_author}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {copy.copy_number}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                                copy.status
                              )}`}
                            >
                              {getStatusLabel(copy.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{copy.location}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {copy.acquired_date}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{copy.notes}</td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => setEditingCopy(copy)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteCopy(copy.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              삭제
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-6">복본 추가</h2>
            <form onSubmit={handleAddCopy}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    도서 선택
                  </label>
                  <select
                    name="book_id"
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">도서를 선택하세요</option>
                    {books.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title} - {book.author}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    복본 번호
                  </label>
                  <input
                    type="number"
                    name="copy_number"
                    required
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상태
                  </label>
                  <select
                    name="status"
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="available">대여 가능</option>
                    <option value="borrowed">대여 중</option>
                    <option value="maintenance">정비 중</option>
                    <option value="lost">분실</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    위치
                  </label>
                  <input
                    type="text"
                    name="location"
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    입수일
                  </label>
                  <input
                    type="date"
                    name="acquired_date"
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    비고
                  </label>
                  <input
                    type="text"
                    name="notes"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
