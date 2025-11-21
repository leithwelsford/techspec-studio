/**
 * IndexedDB Storage Utility
 *
 * Provides high-capacity persistent storage for TechSpec Studio
 * - Supports 50MB+ storage (vs 5-10MB for localStorage)
 * - Async API (non-blocking)
 * - Automatic migration from localStorage
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { ProjectState } from '../store/projectStore';

interface TechSpecDB extends DBSchema {
  'project-state': {
    key: string;
    value: {
      state: ProjectState;
      version: number;
    };
  };
}

const DB_NAME = 'techspec-studio';
const DB_VERSION = 1;
const STORE_NAME = 'project-state';
const STATE_KEY = 'tech-spec-project';

let dbInstance: IDBPDatabase<TechSpecDB> | null = null;

/**
 * Initialize IndexedDB database
 */
async function initDB(): Promise<IDBPDatabase<TechSpecDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<TechSpecDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
        console.log('✅ Created IndexedDB object store:', STORE_NAME);
      }
    },
  });

  console.log('✅ IndexedDB initialized:', DB_NAME);
  return dbInstance;
}

/**
 * Get state from IndexedDB
 */
export async function getState(): Promise<ProjectState | null> {
  try {
    const db = await initDB();
    const data = await db.get(STORE_NAME, STATE_KEY);

    if (data) {
      console.log('📖 Loaded state from IndexedDB:', {
        version: data.version,
        size: JSON.stringify(data.state).length,
      });
      return data.state;
    }

    console.log('ℹ️ No state found in IndexedDB');
    return null;
  } catch (error) {
    console.error('❌ Error loading from IndexedDB:', error);
    return null;
  }
}

/**
 * Save state to IndexedDB
 */
export async function setState(state: ProjectState, version: number = 1): Promise<void> {
  try {
    const db = await initDB();
    await db.put(STORE_NAME, { state, version }, STATE_KEY);

    const size = JSON.stringify(state).length;
    console.log('💾 Saved state to IndexedDB:', {
      version,
      size,
      sizeMB: (size / (1024 * 1024)).toFixed(2) + ' MB',
    });
  } catch (error) {
    console.error('❌ Error saving to IndexedDB:', error);
    throw error;
  }
}

/**
 * Clear state from IndexedDB
 */
export async function clearState(): Promise<void> {
  try {
    const db = await initDB();
    await db.delete(STORE_NAME, STATE_KEY);
    console.log('🗑️ Cleared state from IndexedDB');
  } catch (error) {
    console.error('❌ Error clearing IndexedDB:', error);
    throw error;
  }
}

/**
 * Migrate data from localStorage to IndexedDB
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    console.log('🔄 Starting migration from localStorage to IndexedDB...');

    // Check if data exists in localStorage
    const localData = localStorage.getItem(STATE_KEY);
    if (!localData) {
      console.log('ℹ️ No data in localStorage to migrate');
      return false;
    }

    // Parse localStorage data
    const parsed = JSON.parse(localData);
    const state = parsed.state as ProjectState;
    const version = parsed.version || 1;

    console.log('📦 Found localStorage data:', {
      version,
      size: localData.length,
      sizeMB: (localData.length / (1024 * 1024)).toFixed(2) + ' MB',
    });

    // Check if IndexedDB already has data
    const existingState = await getState();
    if (existingState) {
      console.log('⚠️ IndexedDB already has data. Migration skipped.');
      return false;
    }

    // Save to IndexedDB
    await setState(state, version);

    console.log('✅ Migration complete! Data moved to IndexedDB.');
    console.log('ℹ️ localStorage data will be automatically cleared by new persist middleware');

    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  hasData: boolean;
  size: number;
  sizeMB: string;
  version: number;
}> {
  try {
    const db = await initDB();
    const data = await db.get(STORE_NAME, STATE_KEY);

    if (data) {
      const size = JSON.stringify(data.state).length;
      return {
        hasData: true,
        size,
        sizeMB: (size / (1024 * 1024)).toFixed(2),
        version: data.version,
      };
    }

    return {
      hasData: false,
      size: 0,
      sizeMB: '0',
      version: 0,
    };
  } catch (error) {
    console.error('❌ Error getting storage stats:', error);
    return {
      hasData: false,
      size: 0,
      sizeMB: '0',
      version: 0,
    };
  }
}
