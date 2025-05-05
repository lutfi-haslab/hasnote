import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import PageDetailPage from './pages/PageDetailPage';
import AllPagesPage from './pages/AllPagesPage';
import SettingsPage from './pages/SettingsPage';
import MainLayout from './components/layout/MainLayout';
import SecretPage from './pages/SecretPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="page/:pageId" element={<PageDetailPage />} />
          <Route path="pages" element={<AllPagesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="secret" element={<SecretPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
