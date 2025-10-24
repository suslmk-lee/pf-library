export interface Book {
  id: string;
  title: string;
  author: string;
  publisher: string;
  year: number;
  isbn: string;
  description: string;
  price: number;
  cover_image: string;
  total_copies: number;
  available_copies: number;
}

export interface BookCopy {
  id: number;
  book_id: string;
  copy_number: number;
  status: 'available' | 'borrowed' | 'maintenance' | 'lost';
  location: string;
  acquired_date: string;
  notes: string;
}

export interface BorrowItem {
  id: number;
  user_id: string;
  book_id: string;
  title: string;
  author: string;
  borrowed_at: string;
  due_date: string;
  returned_at?: string | null;
  status: string;
}

export interface LoginRequest {
  id: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: string;
  role: string;
}
