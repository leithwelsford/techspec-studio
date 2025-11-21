/**
 * Custom Zustand Persist Middleware for IndexedDB
 *
 * Drop-in replacement for Zustand's localStorage persist middleware
 * Uses IndexedDB for high-capacity storage
 */

import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { getState, setState, migrateFromLocalStorage } from './indexedDB';

export interface PersistOptions<S> {
  name: string;
  version?: number;
  migrate?: (persistedState: any, currentState: S) => S;
  onRehydrateStorage?: (state: S) => void;
}

type PersistImpl = <T>(
  storeInitializer: StateCreator<T, [], []>,
  options: PersistOptions<T>
) => StateCreator<T, [], []>;

type Persist = <T>(
  initializer: StateCreator<T, [], []>,
  options: PersistOptions<T>
) => StateCreator<T, [], []>;

type Write<T, U extends StoreMutatorIdentifier> = [
  U,
  Parameters<T>[0] extends never ? never : Parameters<T>[0]
];

declare module 'zustand' {
  interface StoreMutators<S, A> {
    'zustand/indexeddb-persist': Write<PersistImpl, unknown>;
  }
}

const persistImpl: PersistImpl = (storeInitializer, options) => {
  return (set, get, store) => {
    const { name, version = 1, migrate, onRehydrateStorage } = options;

    // Create the store with initial state
    const initialState = storeInitializer(
      (...args) => {
        set(...args);
        // Auto-save to IndexedDB on every state change
        queueSave();
      },
      get,
      store
    );

    // Debounced save queue to avoid excessive writes
    let saveTimeout: NodeJS.Timeout | null = null;
    const queueSave = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          const currentState = get();
          await setState(currentState, version);
        } catch (error) {
          console.error('❌ Failed to persist state to IndexedDB:', error);
        }
      }, 100); // 100ms debounce
    };

    // Load persisted state from IndexedDB
    (async () => {
      try {
        console.log('🔄 Loading persisted state from IndexedDB...');

        // Try to migrate from localStorage first (one-time migration)
        const migrated = await migrateFromLocalStorage();
        if (migrated) {
          console.log('✅ Migration from localStorage complete');
          // Clear localStorage after successful migration
          try {
            localStorage.removeItem('tech-spec-project');
            console.log('🗑️ Cleared old localStorage data');
          } catch (error) {
            console.warn('⚠️ Could not clear localStorage:', error);
          }
        }

        // Load state from IndexedDB
        const persistedState = await getState();

        if (persistedState) {
          // Apply migration if provided
          let finalState = persistedState;
          if (migrate) {
            finalState = migrate(persistedState, initialState);
            console.log('🔄 Applied state migration');
          }

          // Merge persisted state with initial state
          set(finalState, true);
          console.log('✅ Rehydrated state from IndexedDB');

          // Call onRehydrateStorage callback
          if (onRehydrateStorage) {
            onRehydrateStorage(finalState);
          }
        } else {
          console.log('ℹ️ No persisted state found, using initial state');
        }
      } catch (error) {
        console.error('❌ Failed to load persisted state:', error);
      }
    })();

    return initialState;
  };
};

/**
 * Create IndexedDB persist middleware
 * Usage: Same as Zustand's persist middleware
 */
export const createIndexedDBPersist = <T>(
  initializer: StateCreator<T, [], []>,
  options: PersistOptions<T>
): StateCreator<T, [], []> => {
  return persistImpl(initializer, options);
};

// Export as default for convenience
export default createIndexedDBPersist;
