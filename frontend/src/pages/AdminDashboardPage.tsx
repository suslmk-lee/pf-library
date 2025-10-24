import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Header from '../components/Header';
import { borrowAPI, bookAPI } from '../services/api';
import type { BorrowItem, Book } from '../types';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [allBorrows, setAllBorrows] = useState<BorrowItem[]>([]);
  const [borrowHistory, setBorrowHistory] = useState<BorrowItem[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      const userId = localStorage.getItem('user_id') || 'admin';
      const [activeBorrows, history, booksData] = await Promise.all([
        borrowAPI.adminGetAllBorrows(),
        borrowAPI.getBorrowHistory(), // 관리자도 자신의 이력을 조회할 수 있음
        bookAPI.getBooks(),
      ]);
      setAllBorrows(activeBorrows);
      setBorrowHistory(history);
      setBooks(booksData);
    } catch (err: any) {
      setError(err.response?.data?.error || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const overdueCount = allBorrows.filter((b) => isOverdue(b.due_date)).length;
  const activeCount = allBorrows.length;

  // 월별 대여 통계 (최근 6개월)
  const getMonthlyStats = () => {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${date.getMonth() + 1}월`;

      const monthBorrows = borrowHistory.filter(b => {
        const borrowDate = new Date(b.borrowed_at);
        return borrowDate.getFullYear() === date.getFullYear() &&
               borrowDate.getMonth() === date.getMonth();
      });

      const monthReturns = borrowHistory.filter(b => {
        if (!b.returned_at) return false;
        const returnDate = new Date(b.returned_at);
        return returnDate.getFullYear() === date.getFullYear() &&
               returnDate.getMonth() === date.getMonth();
      });

      months.push({
        month: monthLabel,
        대여: monthBorrows.length,
        반납: monthReturns.length,
      });
    }

    return months;
  };

  // 상태별 통계
  const getStatusStats = () => {
    const borrowed = allBorrows.filter(b => !isOverdue(b.due_date)).length;
    const overdue = overdueCount;
    const returned = borrowHistory.filter(b => b.status === 'returned').length;

    return [
      { name: '대여 중', value: borrowed, color: '#3b82f6' },
      { name: '연체', value: overdue, color: '#ef4444' },
      { name: '반납 완료', value: returned, color: '#10b981' },
    ];
  };

  // 사용자별 대여 통계
  const userBorrowStats = allBorrows.reduce((acc, borrow) => {
    if (!acc[borrow.user_id]) {
      acc[borrow.user_id] = 0;
    }
    acc[borrow.user_id]++;
    return acc;
  }, {} as Record<string, number>);

  const topBorrowers = Object.entries(userBorrowStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // 복본 가용성 통계
  const totalCopies = books.reduce((sum, book) => sum + book.total_copies, 0);
  const availableCopies = books.reduce((sum, book) => sum + book.available_copies, 0);
  const borrowedCopies = totalCopies - availableCopies;

  const COLORS = ['#3b82f6', '#ef4444', '#10b981'];

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">관리자 대시보드</h2>
          <p className="text-gray-600 mt-2">
            도서관 운영 현황을 한눈에 확인하세요.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">로딩 중...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
        ) : (
          <>
            {/* 주요 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium opacity-90">보유 도서</div>
                  <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="text-4xl font-bold">{books.length}</div>
                <div className="text-xs opacity-80 mt-1">총 {totalCopies}권의 복본</div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium opacity-90">대여 중</div>
                  <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-4xl font-bold">{activeCount}</div>
                <div className="text-xs opacity-80 mt-1">복본 {borrowedCopies}권</div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium opacity-90">연체 중</div>
                  <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-4xl font-bold">{overdueCount}</div>
                <div className="text-xs opacity-80 mt-1">건</div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium opacity-90">대여율</div>
                  <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="text-4xl font-bold">
                  {totalCopies > 0 ? Math.round((borrowedCopies / totalCopies) * 100) : 0}
                </div>
                <div className="text-xs opacity-80 mt-1">%</div>
              </div>
            </div>

            {/* 차트 섹션 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 월별 대여/반납 추이 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">월별 대여/반납 추이</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getMonthlyStats()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="대여" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="반납" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 상태별 분포 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">대여 상태 분포</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getStatusStats()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getStatusStats().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 상위 대여자 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  상위 대여자 (현재 대여 중)
                </h3>
                {topBorrowers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    현재 대여 중인 사용자가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topBorrowers.map(([userId, count], index) => (
                      <div key={userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                            index === 0 ? 'bg-yellow-500' :
                            index === 1 ? 'bg-gray-400' :
                            index === 2 ? 'bg-orange-600' :
                            'bg-blue-500'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="font-medium text-gray-800">{userId}</span>
                        </div>
                        <span className="text-lg font-bold text-blue-600">{count}권</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 빠른 작업 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  빠른 작업
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/admin/borrow-manage')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-medium transition-colors flex items-center justify-between group"
                  >
                    <span>대여 관리</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => navigate('/books')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg font-medium transition-colors flex items-center justify-between group"
                  >
                    <span>도서 검색</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* 최근 대여 활동 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                최근 대여 활동
              </h3>
              {allBorrows.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  최근 대여 활동이 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">사용자</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">도서명</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">대여일</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allBorrows.slice(0, 10).map((borrow) => (
                        <tr key={borrow.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-800">{borrow.user_id}</td>
                          <td className="py-3 px-4 text-gray-700">{borrow.title}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {new Date(borrow.borrowed_at).toLocaleDateString('ko-KR')}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {allBorrows.length > 10 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => navigate('/admin/borrow-manage')}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        전체 대여 목록 보기 →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
