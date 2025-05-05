import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { encryptData, decryptData, hashPin } from '../lib/crypto';

interface Secret {
  id: string;
  name: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

interface KMSState {
  secrets: Secret[];
  loading: boolean;
  error: string | null;
  hasPin: boolean;

  updatePin: (oldPin: string, newPin: string) => Promise<boolean>;
  fetchSecrets: () => Promise<void>;
  addSecret: (name: string, value: string, pin: string) => Promise<void>;
  getSecret: (id: string, pin: string) => Promise<string>;
  deleteSecret: (id: string) => Promise<void>;

  checkHasPin: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  createPin: (pin: string) => Promise<void>;
}

export const useKMSStore = create<KMSState>((set, get) => ({
  secrets: [],
  loading: false,
  error: null,
  hasPin: false,
  updatePin: async (oldPin: string, newPin: string) => {
    try {
      set({ loading: true, error: null });
      const store = get(); // Get current store state

      // Verify old PIN
      const isValid = await store.verifyPin(oldPin);
      if (!isValid) {
        throw new Error('Invalid current PIN');
      }

      // Get current user
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Re-encrypt all secrets with new PIN
      for (const secret of store.secrets) {
        try {
          const decrypted = await decryptData(secret.encrypted_data, oldPin);
          const newEncrypted = await encryptData(decrypted, newPin);

          const { error } = await supabase
            .from('encrypted_secrets')
            .update({ encrypted_data: newEncrypted })
            .eq('id', secret.id)
            .eq('user_id', user.id);

          if (error) throw error;
        } catch (secretError) {
          console.error(`Failed to update secret ${secret.id}:`, secretError);
          throw new Error(
            'Failed to update some secrets. Changes may be partial.'
          );
        }
      }

      // Update PIN hash with user-specific where clause
      const newHashedPin = await hashPin(newPin);
      const { error: pinUpdateError } = await supabase
        .from('user_pins')
        .update({
          pin_hash: newHashedPin,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (pinUpdateError) throw pinUpdateError;

      // Refresh secrets list
      await store.fetchSecrets();

      return true; // Indicate success
    } catch (error: any) {
      console.error('Error updating PIN:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to update PIN',
      });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  fetchSecrets: async () => {
    set({ loading: true, error: null });
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('encrypted_secrets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ secrets: data || [], loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch secrets',
        loading: false,
      });
    }
  },

  addSecret: async (name, value, pin) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Not authenticated');

      const encryptedValue = await encryptData(value, pin);

      const { error } = await supabase.from('encrypted_secrets').insert({
        user_id: user.id,
        name,
        encrypted_data: encryptedValue,
      });

      if (error) throw error;
      await get().fetchSecrets();
    } catch (err) {
      console.error('Failed to add secret:', err);
      throw err;
    }
  },

  getSecret: async (id, pin) => {
    try {
      const { data, error } = await supabase
        .from('encrypted_secrets')
        .select('encrypted_data')
        .eq('id', id)
        .single();

      if (error || !data) throw new Error('Secret not found');
      return await decryptData(data.encrypted_data, pin);
    } catch (err) {
      console.error('Failed to decrypt secret:', err);
      throw err;
    }
  },

  deleteSecret: async (id) => {
    try {
      const { error } = await supabase
        .from('encrypted_secrets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await get().fetchSecrets();
    } catch (err) {
      console.error('Failed to delete secret:', err);
      throw err;
    }
  },

  checkHasPin: async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return set({ hasPin: false });

      const { data } = await supabase
        .from('user_pins')
        .select('id')
        .eq('user_id', user.id)
        .single();

      set({ hasPin: !!data });
    } catch (err) {
      console.error('Failed to check PIN status:', err);
    }
  },

  verifyPin: async (pin) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return false;

      const { data } = await supabase
        .from('user_pins')
        .select('pin_hash')
        .eq('user_id', user.id)
        .single();

      if (!data) return false;
      return (await hashPin(pin)) === data.pin_hash;
    } catch (err) {
      console.error('Failed to verify PIN:', err);
      return false;
    }
  },

  createPin: async (pin) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Not authenticated');

      const pinHash = await hashPin(pin);

      const { error } = await supabase.from('user_pins').upsert({
        user_id: user.id,
        pin_hash: pinHash,
      });

      if (error) throw error;
      set({ hasPin: true });
    } catch (err) {
      console.error('Failed to create PIN:', err);
      throw err;
    }
  },
}));
