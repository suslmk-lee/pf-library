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
}

export interface CartItem {
  book_id: string;
  title: string;
  author: string;
  price: number;
  quantity: number;
  cover_image: string;
}

export interface LoginRequest {
  id: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: string;
}
