/**
 * IndexedDB Wrapper for Solix Local Storage
 * Database Name: solix-chat-v1
 * Stores:
 *   - conversations: keyPath 'id'
 *   - messages: keyPath 'id', index 'conversation_id'
 */

const DB_NAME = "solix-chat-v1";
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported or not in browser environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store: conversations
      if (!db.objectStoreNames.contains("conversations")) {
        const convStore = db.createObjectStore("conversations", { keyPath: "id" });
        convStore.createIndex("updated_at", "updated_at", { unique: false });
      }

      // Store: messages
      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("conversation_id", "conversation_id", { unique: false });
        msgStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
}

