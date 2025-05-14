import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Page, PageType } from '../types';
import { getDB, addToSyncQueue } from '../lib/db';
import toast from 'react-hot-toast';

type PagesState = {
  pages: Page[];
  currentPage: Page | null;
  loading: boolean;
  error: string | null;
  pinnedOrder: string[];
  fetchPinnedOrder: () => Promise<void>;
  reorderPinnedPages: (newOrder: string[]) => Promise<void>;
  fetchPages: () => Promise<void>;
  fetchPageById: (pageId: string) => Promise<void>;
  createPage: (
    title: string,
    type: PageType,
    parentId?: string | null
  ) => Promise<string | null>;
  updatePage: (pageId: string, updates: Partial<Page>) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  togglePinPage: (pageId: string) => Promise<void>;
};

export const usePageStore = create<PagesState>((set, get) => ({
  pages: [],
  currentPage: null,
  loading: false,
  error: null,
  pinnedOrder: [],
  // Update the fetchPinnedOrder function
  fetchPinnedOrder: async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Try IndexedDB first
      const db = await getDB();
      const cachedOrder = await db.get('user_preferences', 'pinned_order');

      // Initialize with empty array if no cached order
      let order = cachedOrder?.value || [];

      // If online, fetch from Supabase
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('preference_value')
          .eq('user_id', user.id)
          .eq('preference_key', 'pinned_order')
          .maybeSingle();

        if (!error && data?.preference_value) {
          order = data.preference_value;
          // Update IndexedDB with fresh data
          await db.put('user_preferences', {
            id: 'pinned_order',
            value: order,
          });
        }
      }

      set({ pinnedOrder: order });
    } catch (error) {
      console.error('Error fetching pinned order:', error);
      set({ pinnedOrder: [] });
    }
  },

  // Update the reorderPinnedPages function
  reorderPinnedPages: async (newOrder: string[]) => {
    try {
      set({ pinnedOrder: newOrder });

      const db = await getDB();
      await db.put('user_preferences', {
        id: 'pinned_order',
        value: newOrder,
      });

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      await addToSyncQueue('upsert', 'user_preferences', {
        user_id: user.id,
        preference_key: 'pinned_order',
        preference_value: newOrder,
        updated_at: new Date().toISOString(),
      });

      if (navigator.onLine) {
        await supabase.from('user_preferences').upsert(
          {
            user_id: user.id,
            preference_key: 'pinned_order',
            preference_value: newOrder,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,preference_key',
          }
        );
      }
    } catch (error: any) {
      console.error('Error reordering pages:', error);
      set({ error: error.message || 'Failed to reorder pages' });
    }
  },
  fetchPages: async () => {
    try {
      set({ loading: true, error: null });

      // Try to get from IndexedDB first
      const db = await getDB();
      const cachedPages = await db.getAll('pages');
      if (cachedPages.length > 0) {
        set({ pages: cachedPages });
      }

      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Update cache
      if (data) {
        const tx = db.transaction('pages', 'readwrite');
        await Promise.all([...data.map((page) => tx.store.put(page)), tx.done]);
      }

      set({ pages: data as Page[] });
    } catch (error: any) {
      console.error('Error fetching pages:', error);
      set({ error: error.message || 'Failed to fetch pages' });
    } finally {
      set({ loading: false });
    }
  },

  fetchPageById: async (pageId) => {
    try {
      set({ loading: true, error: null });

      // Try IndexedDB first
      const db = await getDB();
      const cachedPage = await db.get('pages', pageId);
      if (cachedPage) {
        set({ currentPage: cachedPage });
      }

      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('id', pageId)
        .single();

      if (error) throw error;

      // Update cache
      if (data) {
        await db.put('pages', data);
      }

      set({ currentPage: data as Page });
    } catch (error: any) {
      console.error('Error fetching page:', error);
      set({ error: error.message || 'Failed to fetch page' });
    } finally {
      set({ loading: false });
    }
  },

  createPage: async (title: string, type: PageType, parentId = null) => {
    try {
      set({ loading: true, error: null });

      const user = (await supabase.auth.getUser()).data.user;

      if (!user) {
        throw new Error('User not authenticated');
      }

      const newPage = {
        id: crypto.randomUUID(),
        title,
        type,
        content: {},
        parent_id: parentId,
        is_pinned: false,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update local state immediately
      const pages = [...get().pages, newPage];
      set({ pages });

      // Store in IndexedDB
      const db = await getDB();
      await db.add('pages', newPage);

      // Add to sync queue
      await addToSyncQueue('create', 'pages', newPage);

      // Try to sync with Supabase
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('pages')
          .insert(newPage)
          .select()
          .single();

        if (error) throw error;
      }

      return newPage.id;
    } catch (error: any) {
      console.error('Error creating page:', error);
      set({ error: error.message || 'Failed to create page' });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  updatePage: async (pageId, updates) => {
    try {
      set({ loading: true, error: null });

      // Get current state
      const currentPages = get().pages;
      const currentPage = get().currentPage;

      // Find the page to update
      const pageToUpdate = currentPages.find((p) => p.id === pageId);
      if (!pageToUpdate) {
        throw new Error('Page not found');
      }

      // Create updated page
      const updatedPage = {
        ...pageToUpdate,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Update local state
      const updatedPages = currentPages.map((page) =>
        page.id === pageId ? updatedPage : page
      );

      const updatedCurrentPage =
        currentPage?.id === pageId ? updatedPage : currentPage;

      set({ pages: updatedPages, currentPage: updatedCurrentPage });

      // Update IndexedDB
      const db = await getDB();
      try {
        await db.put('pages', updatedPage);
      } catch (error) {
        console.error('IndexedDB update error:', error);
        throw error;
      }

      // Add to sync queue
      await addToSyncQueue('update', 'pages', { ...updatedPage });

      // Try to sync with Supabase if online
      if (navigator.onLine) {
        const { error } = await supabase
          .from('pages')
          .update(updatedPage)
          .eq('id', pageId);

        if (error) throw error;
      }

      toast.success('Changes saved successfully!');
    } catch (error: any) {
      console.error('Error updating page:', error);
      set({ error: error.message || 'Failed to update page' });
      throw error; // Re-throw for calling code to handle if needed
    } finally {
      set({ loading: false });
    }
  },
  deletePage: async (pageId) => {
    try {
      set({ loading: true, error: null });

      // Check for child pages
      const childPages = get().pages.filter((p) => p.parent_id === pageId);
      if (childPages.length > 0) {
        throw new Error(
          'Cannot delete a page with child pages. Please delete or move the child pages first.'
        );
      }

      // Update local state
      const pages = get().pages.filter((page) => page.id !== pageId);
      const currentPage =
        get().currentPage?.id === pageId ? null : get().currentPage;
      set({ pages, currentPage });

      // Remove from IndexedDB
      const db = await getDB();
      await db.delete('pages', pageId);

      // Add to sync queue
      await addToSyncQueue('delete', 'pages', { id: pageId });

      // Try to sync with Supabase
      if (navigator.onLine) {
        const { error } = await supabase
          .from('pages')
          .delete()
          .eq('id', pageId);

        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error deleting page:', error);
      set({ error: error.message || 'Failed to delete page' });
    } finally {
      set({ loading: false });
    }
  },

  togglePinPage: async (pageId) => {
    const page = get().pages.find((p) => p.id === pageId);
    if (!page) {
      set({ error: 'Page not found' });
      return;
    }

    const newPinnedState = !page.is_pinned;

    try {
      set({ loading: true, error: null });

      const updatedPage = {
        ...page,
        is_pinned: newPinnedState,
        updated_at: new Date().toISOString(),
      };

      // Update local state
      const pages = get().pages.map((p) => (p.id === pageId ? updatedPage : p));

      const currentPage =
        get().currentPage?.id === pageId ? updatedPage : get().currentPage;

      set({ pages, currentPage });

      // Update IndexedDB
      const db = await getDB();
      await db.put('pages', updatedPage);

      // Add to sync queue
      await addToSyncQueue('update', 'pages', updatedPage);

      // Try to sync with Supabase
      if (navigator.onLine) {
        const { error } = await supabase
          .from('pages')
          .update(updatedPage)
          .eq('id', pageId);

        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error toggling pin state:', error);
      set({ error: error.message || 'Failed to update page' });
    } finally {
      set({ loading: false });
    }
  },

  // reorderPinnedPages: async (newOrder) => {
  //   try {
  //     set({ pinnedOrder: newOrder });

  //     if (navigator.onLine) {
  //       // Update the order in Supabase
  //       // You'll need to create a new table or column to store the order
  //       // For now, we'll just update the local state
  //     }
  //   } catch (error: any) {
  //     console.error('Error reordering pages:', error);
  //     set({ error: error.message || 'Failed to reorder pages' });
  //   }
  // },
}));
