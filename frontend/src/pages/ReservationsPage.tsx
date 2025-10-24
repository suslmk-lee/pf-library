import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { reservationAPI } from '../services/api';

interface Reservation {
  id: number;
  user_id: string;
  book_id: string;
  book_title: string;
  book_author: string;
  reserved_at: string;
  expires_at: string;
  status: string;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    if (userId) {
      loadReservations();
    }
  }, [userId]);

  const loadReservations = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const data = await reservationAPI.getReservations(userId);
      setReservations(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '예약 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!userId || !confirm('예약을 취소하시겠습니까?')) return;

    try {
      await reservationAPI.cancelReservation(id, userId);
      setSuccess('예약이 취소되었습니다.');
      loadReservations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '예약 취소에 실패했습니다.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">활성</span>;
      case 'fulfilled':
        return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">완료</span>;
      case 'expired':
        return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">만료</span>;
      case 'cancelled':
        return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">취소됨</span>;
      default:
        return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
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

  const isExpiringSoon = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2 && diffDays >= 0;
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
        <h1 className="text-3xl font-bold text-gray-800 mb-6">내 예약 목록</h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-4">{success}</div>
        )}

        {reservations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-24 h-24 mx-auto mb-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-xl text-gray-600 mb-4">예약한 도서가 없습니다</p>
            <p className="text-gray-500">
              대여 불가능한 도서를 예약하면 도서가 반납될 때 알림을 받을 수 있습니다
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((reservation) => (
              <div
                key={reservation.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold text-gray-800">
                        {reservation.book_title}
                      </h2>
                      {getStatusBadge(reservation.status)}
                    </div>
                    <p className="text-gray-600 mb-4">{reservation.book_author}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">예약일:</span>
                        <span className="ml-2 text-gray-800">
                          {formatDate(reservation.reserved_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">만료일:</span>
                        <span className="ml-2 text-gray-800">
                          {formatDate(reservation.expires_at)}
                        </span>
                        {isExpiringSoon(reservation.expires_at) && reservation.status === 'active' && (
                          <span className="ml-2 text-red-600 font-semibold">
                            (곧 만료)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {reservation.status === 'active' && (
                    <button
                      onClick={() => handleCancel(reservation.id)}
                      className="ml-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      예약 취소
                    </button>
                  )}
                </div>

                {reservation.status === 'active' && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      도서가 반납되면 알림을 보내드립니다
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
