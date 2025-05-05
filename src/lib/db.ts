import { openDB, DBSchema } from 'idb';
import { Page, TodoItem } from '../types';

interface NotionCloneDB extends DBSchema {
  pages: {
    key: string;
    value: Page;
    indexes: { 'by-updated': Date };
  };
  todos: {
    key: string;
    value: TodoItem;
    indexes: { 'by-page': string };
  };
  syncQueue: {
    key: number; // Changed from 'any' to 'number' since it's auto-incremented
    value: {
      id: number;
      type: 'create' | 'update' | 'delete';
      table: 'pages' | 'todos' | 'meta' | 'user_preferences';
      data: any;
      timestamp: Date;
    };
  };
  user_preferences: {
    key: string;
    value: {
      id: string;
      value: any;
    };
    indexes: { 'by-id': string };
  };
}

// Create a function to initialize the database
export function initDB() {
  return openDB<NotionCloneDB>('notion-clone', 2, {
    // Version bumped to 2
    upgrade(db, oldVersion) {
      // Migration from version 1 to 2
      if (oldVersion < 1) {
        const pagesStore = db.createObjectStore('pages', { keyPath: 'id' });
        pagesStore.createIndex('by-updated', 'updated_at');
        const todosStore = db.createObjectStore('todos', { keyPath: 'id' });
        todosStore.createIndex('by-page', 'page_id');
        db.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true,
        });
      }

      if (oldVersion < 2) {
        const userPrefsStore = db.createObjectStore('user_preferences', {
          keyPath: 'id',
        });
        userPrefsStore.createIndex('by-id', 'id');
      }
    },
  });
}

// Create a database promise that can be used throughout the module
let dbPromise = initDB();

// Export functions that use the database promise
export async function addToSyncQueue(
  type: 'create' | 'update' | 'delete',
  table: 'pages' | 'todos' | 'meta' | 'user_preferences',
  data: any
) {
  const db = await dbPromise;
  await db.add('syncQueue', {
    type,
    table,
    data,
    timestamp: new Date(),
  });
}

export async function processSyncQueue() {
  const db = await dbPromise;
  const tx = db.transaction('syncQueue', 'readwrite');
  const store = tx.objectStore('syncQueue');
  const items = await store.getAll();

  for (const item of items) {
    try {
      // Process sync item
      // Add your Supabase sync logic here
      await store.delete(item.id);
    } catch (error) {
      console.error('Sync failed for item:', item, error);
    }
  }
}

// Helper functions for user preferences
export async function getUserPreference(key: string) {
  const db = await dbPromise;
  const pref = await db.get('user_preferences', key);
  return pref?.value;
}

export async function setUserPreference(key: string, value: any) {
  const db = await dbPromise;
  await db.put('user_preferences', { id: key, value });
  await addToSyncQueue('update', 'user_preferences', { id: key, value });
}

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    await processSyncQueue();
  });
}

// Export a convenience getter for the database
export async function getDB() {
  return dbPromise;
}
