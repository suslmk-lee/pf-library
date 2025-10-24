import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { bookAPI, BookFilters } from '../services/api';
import type { Book } from '../types';

export default function BooksPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 필터 상태
  const [filters, setFilters] = useState<BookFilters>({
    search: '',
    author: '',
    publisher: '',
    year: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async (searchFilters?: BookFilters) => {
    try {
      setLoading(true);
      const data = await bookAPI.getBooks(searchFilters);
      setBooks(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '도서 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const activeFilters: BookFilters = {};
    if (filters.search) activeFilters.search = filters.search;
    if (filters.author) activeFilters.author = filters.author;
    if (filters.publisher) activeFilters.publisher = filters.publisher;
    if (filters.year) activeFilters.year = filters.year;

    loadBooks(activeFilters);
  };

  const handleReset = () => {
    setFilters({
      search: '',
      author: '',
      publisher: '',
      year: '',
    });
    loadBooks();
  };

  const handleViewDetails = (book: Book) => {
    navigate(`/books/${book.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">도서 검색</h2>
          <p className="text-gray-600 mt-2">
            원하는 도서를 검색하고 상세 정보를 확인하세요. 대여는 도서관 방문 시 카운터에서 진행됩니다.
          </p>
        </div>

        {/* 검색 및 필터 영역 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="도서 제목으로 검색..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              검색
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              필터
            </button>
          </div>

          {/* 상세 필터 */}
          {showFilters && (
            <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  저자
                </label>
                <input
                  type="text"
                  placeholder="저자명"
                  value={filters.author}
                  onChange={(e) => setFilters({ ...filters, author: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  출판사
                </label>
                <input
                  type="text"
                  placeholder="출판사명"
                  value={filters.publisher}
                  onChange={(e) => setFilters({ ...filters, publisher: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  출판년도
                </label>
                <input
                  type="number"
                  placeholder="YYYY"
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-3 flex gap-2 justify-end">
                <button
                  onClick={handleReset}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  초기화
                </button>
                <button
                  onClick={handleSearch}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  필터 적용
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">로딩 중...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="h-64 bg-gray-200 flex items-center justify-center">
                  {book.cover_image ? (
                    <img
                      src={book.cover_image}
                      alt={book.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 text-center p-4">
                      <svg
                        className="w-16 h-16 mx-auto mb-2"
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
                      <span className="text-sm">이미지 없음</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 line-clamp-1">
                    {book.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2">{book.author}</p>
                  <p className="text-gray-500 text-xs mb-2">
                    {book.publisher} ({book.year})
                  </p>
                  <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                    {book.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="text-gray-600 text-sm">
                      <span className="font-medium">ISBN:</span> {book.isbn}
                    </div>
                    <button
                      onClick={() => handleViewDetails(book)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      상세보기
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && books.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            등록된 도서가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
