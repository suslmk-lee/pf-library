import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { bookAPI, cartAPI } from '../services/api';
import type { Book } from '../types';

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingBookId, setAddingBookId] = useState<string | null>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const data = await bookAPI.getBooks();
      setBooks(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '도서 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (book: Book) => {
    try {
      setAddingBookId(book.id);
      await cartAPI.addToCart(book);
      // 장바구니 업데이트 이벤트 발생
      window.dispatchEvent(new Event('cartUpdated'));
      alert(`"${book.title}"이(가) 장바구니에 추가되었습니다.`);
    } catch (err: any) {
      alert(err.response?.data?.error || '장바구니 추가에 실패했습니다.');
    } finally {
      setAddingBookId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">도서 목록</h2>
          <p className="text-gray-600 mt-2">
            원하는 도서를 장바구니에 담아보세요.
          </p>
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
                    <span className="text-blue-600 font-bold text-lg">
                      {book.price.toLocaleString()}원
                    </span>
                    <button
                      onClick={() => handleAddToCart(book)}
                      disabled={addingBookId === book.id}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400"
                    >
                      {addingBookId === book.id ? '추가 중...' : '담기'}
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
