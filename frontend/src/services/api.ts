import axios from 'axios';
import type { Book, BorrowItem, LoginRequest, LoginResponse } from '../types';

// API Gateway URL
// 프로덕션: Nginx가 /api를 API Gateway로 프록시
// 로컬 개발: Vite dev server가 /api를 localhost:8080으로 프록시
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 - 토큰 추가
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 - 401 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('role');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 인증 API
export const authAPI = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    console.log('[API] Login request:', data);
    console.log('[API] API Base URL:', API_BASE_URL);
    try {
      const response = await api.post<LoginResponse>('/users/login', data);
      console.log('[API] Login response:', response);
      return response.data;
    } catch (error) {
      console.error('[API] Login error:', error);
      throw error;
    }
  },
  logout: async (): Promise<void> => {
    await api.post('/users/logout');
  },
};

// 도서 API
export interface BookFilters {
  search?: string;
  author?: string;
  publisher?: string;
  year?: string;
}

export const bookAPI = {
  getBooks: async (filters?: BookFilters): Promise<Book[]> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.author) params.append('author', filters.author);
    if (filters?.publisher) params.append('publisher', filters.publisher);
    if (filters?.year) params.append('year', filters.year);

    const queryString = params.toString();
    const url = queryString ? `/books?${queryString}` : '/books';

    const response = await api.get<Book[]>(url);
    return response.data;
  },
  getBook: async (id: string): Promise<Book> => {
    const response = await api.get<Book>(`/books/${id}`);
    return response.data;
  },
  getBookCopies: async (id: string): Promise<any[]> => {
    const response = await api.get<any[]>(`/books/${id}/copies`);
    return response.data;
  },
  // 관리자: 복본 관리
  adminGetAllCopies: async (bookId?: string): Promise<any[]> => {
    const url = bookId ? `/admin/copies?book_id=${bookId}` : '/admin/copies';
    const response = await api.get<any[]>(url);
    return response.data;
  },
  adminAddCopy: async (data: {
    book_id: string;
    copy_number: number;
    status: string;
    location: string;
    acquired_date: string;
    notes: string;
  }): Promise<void> => {
    await api.post('/admin/copies', data);
  },
  adminUpdateCopy: async (id: number, data: {
    status: string;
    location: string;
    acquired_date: string;
    notes: string;
  }): Promise<void> => {
    await api.put(`/admin/copies/${id}`, data);
  },
  adminDeleteCopy: async (id: number): Promise<void> => {
    await api.delete(`/admin/copies/${id}`);
  },
};

// 대여 API
export const borrowAPI = {
  getBorrows: async (): Promise<BorrowItem[]> => {
    const response = await api.get<BorrowItem[]>('/borrows');
    return response.data;
  },
  getBorrowHistory: async (): Promise<BorrowItem[]> => {
    const response = await api.get<BorrowItem[]>('/borrows/history');
    return response.data;
  },
  borrowBook: async (book: Book): Promise<void> => {
    await api.post('/borrows/borrow', {
      book_id: book.id,
      title: book.title,
      author: book.author,
    });
  },
  returnBook: async (bookId: string): Promise<void> => {
    await api.post(`/borrows/return/${bookId}`);
  },
  // 관리자 전용 API
  adminGetAllBorrows: async (): Promise<BorrowItem[]> => {
    const response = await api.get<BorrowItem[]>('/borrows/admin/all');
    return response.data;
  },
  adminGetAllHistory: async (): Promise<BorrowItem[]> => {
    const response = await api.get<BorrowItem[]>('/borrows/admin/history');
    return response.data;
  },
  adminBorrowBook: async (userId: string, book: Book): Promise<void> => {
    await api.post('/borrows/admin/borrow', {
      user_id: userId,
      book_id: book.id,
      title: book.title,
      author: book.author,
    });
  },
  adminReturnBook: async (borrowId: number): Promise<void> => {
    await api.post(`/borrows/admin/return/${borrowId}`);
  },
};

// 알림 API
export const notificationAPI = {
  getNotifications: async (userId: string): Promise<any[]> => {
    const response = await api.get(`/notifications?user_id=${userId}`);
    return response.data;
  },
  getUnreadCount: async (userId: string): Promise<number> => {
    const response = await api.get<{count: number}>(`/notifications/unread-count?user_id=${userId}`);
    return response.data.count;
  },
  markAsRead: async (id: number): Promise<void> => {
    await api.put(`/notifications/${id}/read`);
  },
  markAllAsRead: async (userId: string): Promise<void> => {
    await api.put(`/notifications/mark-all-read?user_id=${userId}`);
  },
  deleteNotification: async (id: number): Promise<void> => {
    await api.delete(`/notifications/${id}`);
  },
};

// 예약 API
export const reservationAPI = {
  createReservation: async (userId: string, bookId: string): Promise<void> => {
    await api.post('/reservations', { user_id: userId, book_id: bookId });
  },
  getReservations: async (userId: string): Promise<any[]> => {
    const response = await api.get(`/reservations?user_id=${userId}`);
    return response.data;
  },
  cancelReservation: async (id: number, userId: string): Promise<void> => {
    await api.delete(`/reservations/${id}?user_id=${userId}`);
  },
};

export default api;
