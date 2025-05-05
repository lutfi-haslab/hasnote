import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User } from '../types';

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  fetchUser: async () => {
    try {
      set({ loading: true, error: null });
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (userError) throw userError;
        
        set({
          user: {
            id: session.user.id,
            email: session.user.email!,
            name: userData?.name,
            avatar_url: userData?.avatar_url,
          },
          initialized: true,
        });
      } else {
        set({ user: null, initialized: true });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      set({ error: 'Failed to fetch user', initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (email, password) => {
    try {
      set({ loading: true, error: null });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        set({
          user: {
            id: data.user.id,
            email: data.user.email!,
          },
        });
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      set({ error: error.message || 'Failed to sign in' });
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password) => {
    try {
      set({ loading: true, error: null });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      // User has been created but not signed in yet
      if (data) {
        set({
          user: null,
          error: 'Please check your email to confirm your account.',
        });
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      set({ error: error.message || 'Failed to sign up' });
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    try {
      set({ loading: true, error: null });
      
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      set({ user: null });
    } catch (error: any) {
      console.error('Sign out error:', error);
      set({ error: error.message || 'Failed to sign out' });
    } finally {
      set({ loading: false });
    }
  },
}));