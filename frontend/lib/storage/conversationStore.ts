import { openDB } from "./db";
import { ConversationSummary, Message } from "@/types/chat";

/**
 * Local IndexedDB operations for Solix Conversations and Messages.
 * Guarantees complete client-side device privacy and zero cross-device leaks.
 */

export const conversationStore = {
  /**
   * List all stored conversations, newest updated first.
   */
  async listConversations(): Promise<ConversationSummary[]> {
    if (typeof window === "undefined") return [];
    try {
      const db = await openDB();
      return new Promise<ConversationSummary[]>((resolve, reject) => {
        const tx = db.transaction("conversations", "readonly");
        const store = tx.objectStore("conversations");
        const request = store.getAll();

        request.onsuccess = () => {
          const list: ConversationSummary[] = request.result || [];
          // Sort by updated_at descending
          list.sort((a, b) => {
            const timeA = new Date(a.updated_at).getTime() || 0;
            const timeB = new Date(b.updated_at).getTime() || 0;
            return timeB - timeA;
          });
          resolve(list);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error("IndexedDB: Failed to list conversations", err);
      return [];
    }
  },

  /**
   * Create or update a conversation entry in local storage.
   */
  async createConversation(id: string, title: string = "New Chat"): Promise<ConversationSummary> {
    if (typeof window === "undefined") {
      const now = new Date().toISOString();
      return { id, title, created_at: now, updated_at: now, message_count: 0 };
    }
    const db = await openDB();
    const now = new Date().toISOString();

    const conv: ConversationSummary = {
      id,
      title,
      created_at: now,
      updated_at: now,
      message_count: 0,
    };

    return new Promise<ConversationSummary>((resolve, reject) => {
      const tx = db.transaction("conversations", "readwrite");
      const store = tx.objectStore("conversations");
      const req = store.put(conv);

      req.onsuccess = () => resolve(conv);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Update the title of an existing conversation.
   */
  async updateConversationTitle(id: string, title: string): Promise<void> {
    if (typeof window === "undefined") return;
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("conversations", "readwrite");
      const store = tx.objectStore("conversations");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const conv: ConversationSummary = getReq.result;
        if (!conv) {
          return resolve();
        }
        conv.title = title;
        conv.updated_at = new Date().toISOString();
        const putReq = store.put(conv);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  },

  /**
   * Delete a conversation and all its messages.
   */
  async deleteConversation(id: string): Promise<void> {
    if (typeof window === "undefined") return;
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["conversations", "messages"], "readwrite");
      const convStore = tx.objectStore("conversations");
      const msgStore = tx.objectStore("messages");

      // Delete conversation entry
      convStore.delete(id);

      // Find and delete all messages with conversation_id === id
      const index = msgStore.index("conversation_id");
      const req = index.openCursor(IDBKeyRange.only(id));

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Add or overwrite a message and update conversation metadata.
   */
  async addMessage(message: Message): Promise<void> {
    if (typeof window === "undefined") return;
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["conversations", "messages"], "readwrite");
      const msgStore = tx.objectStore("messages");
      const convStore = tx.objectStore("conversations");

      // Store message
      msgStore.put(message);

      // Update conversation updated_at and message_count if conversation exists
      if (message.conversation_id) {
        const getConvReq = convStore.get(message.conversation_id);
        getConvReq.onsuccess = () => {
          const conv: ConversationSummary = getConvReq.result;
          if (conv) {
            conv.updated_at = new Date().toISOString();
            // Count messages in conversation
            const countReq = msgStore.index("conversation_id").count(IDBKeyRange.only(message.conversation_id));
            countReq.onsuccess = () => {
              conv.message_count = countReq.result;
              convStore.put(conv);
            };
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Delete a single message by its ID.
   */
  async deleteMessage(messageId: string): Promise<void> {
    if (typeof window === "undefined") return;
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");
      store.delete(messageId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Retrieve all messages for a conversation, sorted chronologically.
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    if (typeof window === "undefined") return [];
    try {
      const db = await openDB();
      return new Promise<Message[]>((resolve, reject) => {
        const tx = db.transaction("messages", "readonly");
        const store = tx.objectStore("messages");
        const index = store.index("conversation_id");
        const req = index.getAll(IDBKeyRange.only(conversationId));

        req.onsuccess = () => {
          const msgs: Message[] = req.result || [];
          // Sort chronologically by timestamp
          msgs.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime() || 0;
            const timeB = new Date(b.timestamp).getTime() || 0;
            return timeA - timeB;
          });
          resolve(msgs);
        };

        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error("IndexedDB: Failed to get messages", err);
      return [];
    }
  },

  /**
   * Fast, local search across all stored messages.
   * Returns a map of conversationId -> matched snippet.
   */
  async searchAcrossConversations(query: string): Promise<Record<string, string>> {
    if (!query || !query.trim() || typeof window === "undefined") return {};
    try {
      const db = await openDB();
      return new Promise<Record<string, string>>((resolve, reject) => {
        const tx = db.transaction("messages", "readonly");
        const store = tx.objectStore("messages");
        const req = store.getAll();

        req.onsuccess = () => {
          const msgs: Message[] = req.result || [];
          const q = query.toLowerCase().trim();
          const snippets: Record<string, string> = {};

          for (const m of msgs) {
            if (!m.content || !m.conversation_id || snippets[m.conversation_id]) continue;
            const lower = m.content.toLowerCase();
            const idx = lower.indexOf(q);
            if (idx !== -1) {
              const start = Math.max(0, idx - 20);
              const end = Math.min(m.content.length, idx + q.length + 35);
              const text = m.content.substring(start, end).replace(/\s+/g, " ").trim();
              snippets[m.conversation_id] = (start > 0 ? "…" : "") + text + (end < m.content.length ? "…" : "");
            }
          }
          resolve(snippets);
        };

        req.onerror = () => reject(req.error);
      });
    } catch {
      return {};
    }
  },

  /**
   * Completely clear all local conversations and messages (Device Reset).
   */
  async clearAllConversations(): Promise<void> {
    if (typeof window === "undefined") return;
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["conversations", "messages"], "readwrite");
      tx.objectStore("conversations").clear();
      tx.objectStore("messages").clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

