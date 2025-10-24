import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { borrowAPI } from '../services/api';
import type { BorrowItem } from '../types';

export default function BorrowHistoryPage() {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<BorrowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await borrowAPI.getBorrowHistory();
      setHistoryItems(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '대여 이력을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
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

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'returned') return false;
    return new Date(dueDate) < new Date();
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    if (status === 'returned') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          반납 완료
        </span>
      );
    }
    if (isOverdue(dueDate, status)) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          연체 중
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
        대여 중
      </span>
    );
  };

  const filteredItems = historyItems.filter((item) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'borrowed') return item.status === 'borrowed';
    if (filterStatus === 'returned') return item.status === 'returned';
    if (filterStatus === 'overdue')
      return item.status === 'borrowed' && isOverdue(item.due_date, item.status);
    return true;
  });

  const stats = {
    total: historyItems.length,
    borrowed: historyItems.filter((item) => item.status === 'borrowed').length,
    returned: historyItems.filter((item) => item.status === 'returned').length,
    overdue: historyItems.filter(
      (item) => item.status === 'borrowed' && isOverdue(item.due_date, item.status)
    ).length,
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">대여 이력</h2>
          <p className="text-gray-600 mt-2">
            모든 도서 대여 이력을 확인할 수 있습니다.
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">전체 이력</div>
            <div className="text-3xl font-bold text-gray-800">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-blue-600 mb-1">대여 중</div>
            <div className="text-3xl font-bold text-blue-800">{stats.borrowed}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-green-600 mb-1">반납 완료</div>
            <div className="text-3xl font-bold text-green-800">{stats.returned}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-red-600 mb-1">연체 중</div>
            <div className="text-3xl font-bold text-red-800">{stats.overdue}</div>
          </div>
        </div>

        {/* 필터 버튼 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              전체 ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('borrowed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'borrowed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              대여 중 ({stats.borrowed})
            </button>
            <button
              onClick={() => setFilterStatus('returned')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'returned'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              반납 완료 ({stats.returned})
            </button>
            <button
              onClick={() => setFilterStatus('overdue')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'overdue'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              연체 중 ({stats.overdue})
            </button>
          </div>
        </div>

        {/* 이력 목록 */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">로딩 중...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-600 mb-4">
              {filterStatus === 'all'
                ? '대여 이력이 없습니다.'
                : '해당 조건의 이력이 없습니다.'}
            </p>
            <button
              onClick={() => navigate('/books')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              도서 검색하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-800">
                        {item.title}
                      </h3>
                      {getStatusBadge(item.status, item.due_date)}
                    </div>
                    <p className="text-gray-600 mb-3">{item.author}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">대여일:</span>{' '}
                        <span className="text-gray-700 font-medium">
                          {formatDateTime(item.borrowed_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">반납 예정일:</span>{' '}
                        <span
                          className={`font-medium ${
                            isOverdue(item.due_date, item.status)
                              ? 'text-red-600'
                              : 'text-gray-700'
                          }`}
                        >
                          {formatDate(item.due_date)}
                          {isOverdue(item.due_date, item.status) &&
                            item.status === 'borrowed' &&
                            ' (연체)'}
                        </span>
                      </div>
                      {item.returned_at && (
                        <div>
                          <span className="text-gray-500">반납일:</span>{' '}
                          <span className="text-green-700 font-medium">
                            {formatDateTime(item.returned_at)}
                          </span>
                        </div>
                      )}
                      {item.status === 'borrowed' && (
                        <div>
                          <span className="text-gray-500">대여 기간:</span>{' '}
                          <span className="text-gray-700 font-medium">
                            {Math.floor(
                              (new Date().getTime() -
                                new Date(item.borrowed_at).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )}
                            일
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {item.status === 'borrowed' && (
                    <button
                      onClick={() => navigate('/borrows')}
                      className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                      상세보기
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
