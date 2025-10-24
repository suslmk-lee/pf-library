import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ id: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(formData);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user_id', response.user_id);
      localStorage.setItem('role', response.role);
      navigate('/books');
    } catch (err: any) {
      setError(err.response?.data?.error || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl border border-gray-200 p-8">
        <div className="text-center mb-8">
          <div className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg mb-4">
            <h1 className="text-3xl font-bold">
              국립 중앙 도서관
            </h1>
          </div>
          <p className="text-gray-600 font-medium">도서 대여 시스템 - PlugFest 2025</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사용자 ID
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) =>
                setFormData({ ...formData, id: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="user"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:from-gray-400 disabled:to-gray-400"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg">
          <p className="text-sm text-gray-700 font-semibold mb-2">테스트 계정:</p>
          <div className="space-y-1">
            <p className="text-xs text-gray-600">• ID: user / PW: password</p>
            <p className="text-xs text-gray-600">• ID: admin / PW: admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
