import axios from 'axios';
import type { Book, CartItem, LoginRequest, LoginResponse } from '../types';

// API Gateway URL (환경 변수로 설정)
const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || '/api';

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
export const bookAPI = {
  getBooks: async (): Promise<Book[]> => {
    const response = await api.get<Book[]>('/books');
    return response.data;
  },
  getBook: async (id: string): Promise<Book> => {
    const response = await api.get<Book>(`/books/${id}`);
    return response.data;
  },
};

// 장바구니 API
export const cartAPI = {
  getCart: async (): Promise<CartItem[]> => {
    const response = await api.get<CartItem[]>('/cart');
    return response.data;
  },
  addToCart: async (book: Book): Promise<void> => {
    await api.post('/cart/add', {
      book_id: book.id,
      title: book.title,
      author: book.author,
      price: book.price,
      cover_image: book.cover_image,
    });
  },
  removeFromCart: async (bookId: string): Promise<void> => {
    await api.delete(`/cart/remove/${bookId}`);
  },
  clearCart: async (): Promise<void> => {
    await api.post('/cart/clear');
  },
};

export default api;
