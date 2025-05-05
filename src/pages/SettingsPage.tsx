import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Avatar from '../components/ui/Avatar';
import Spinner from '../components/ui/Spinner';
import { supabase } from '../lib/supabase';
import SecretPage from './SecretPage';

const SettingsPage: React.FC = () => {
  const { user, signOut } = useAuthStore();

  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name,
          avatar_url: avatarUrl,
        })
        .eq('id', user.id);

      if (error) throw error;

      setSuccess(true);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Settings</h1>

      <div className="space-y-8">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-xl font-semibold">Profile Settings</h2>
          </div>

          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
              <Avatar user={user} size="lg" />

              <div>
                <h3 className="font-medium text-lg text-slate-800">
                  {user?.name || 'User'}
                </h3>
                <p className="text-slate-600">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="avatarUrl"
                  className="block text-sm font-medium text-slate-700"
                >
                  Avatar URL
                </label>
                <Input
                  id="avatarUrl"
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-sm text-slate-500">
                  Enter a URL for your profile picture.
                </p>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}
              {success && (
                <div className="text-sm text-green-600">
                  Profile updated successfully!
                </div>
              )}

              <div>
                <Button
                  type="submit"
                  className="flex items-center gap-2"
                  disabled={loading}
                >
                  {loading && <Spinner size="sm" />}
                  <User size={16} />
                  <span>{loading ? 'Updating...' : 'Update Profile'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
        <SecretPage />
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-xl font-semibold">Account</h2>
          </div>

          <div className="p-6">
            <Button
              variant="outline"
              className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
