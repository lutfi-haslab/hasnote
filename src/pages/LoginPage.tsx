import React from 'react';
import { Navigate } from 'react-router-dom';
import { Book } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import LoginForm from '../components/auth/LoginForm';

const LoginPage: React.FC = () => {
  const { user, initialized, loading } = useAuthStore();
  
  if (initialized && !loading && user) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Book size={24} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome back</h1>
          <p className="text-slate-600 mt-2">Sign in to your account</p>
        </div>
        
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;