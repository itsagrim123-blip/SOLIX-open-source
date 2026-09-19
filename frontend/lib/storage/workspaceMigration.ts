/**
 * WorkspaceMigration — One-click migration of legacy server workspaces to local IndexedDB
 */

import { getApiUrl } from "@/lib/config";
import { workspaceStorage } from "./workspaceStorage";

export interface LegacyWorkspaceExport {
  id: string;
  name: string;
  template: string;
  files: Array<{ path: string; content: string }>;
}

export const workspaceMigration = {
  /**
   * Check whether local IndexedDB is empty and whether backend has legacy projects to migrate.
   */
  async checkPendingMigration(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      const localWorkspaces = await workspaceStorage.listWorkspaces();
      if (localWorkspaces.length > 0) {
        // User already has local workspaces, no need for auto-migration
        return false;
      }

      // Check backend for legacy workspaces
      const res = await fetch(getApiUrl("/api/workspaces/legacy-export"), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) return false;
      const data: LegacyWorkspaceExport[] = await res.json();
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  },

  /**
   * Migrate legacy server workspaces to local IndexedDB.
   */
  async migrateServerWorkspaces(): Promise<number> {
    if (typeof window === "undefined") return 0;
    try {
      const res = await fetch(getApiUrl("/api/workspaces/legacy-export"), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) return 0;
      const legacyWorkspaces: LegacyWorkspaceExport[] = await res.json();
      let totalMigrated = 0;

      for (const legacy of legacyWorkspaces) {
        // Create local workspace
        const ws = await workspaceStorage.createWorkspace(legacy.name, legacy.template || "starter-python");
        
        // Populate files
        if (legacy.files && legacy.files.length > 0) {
          for (const file of legacy.files) {
            await workspaceStorage.writeFile(ws.id, file.path, file.content);
          }
        }
        totalMigrated++;
      }

      return totalMigrated;
    } catch (err) {
      console.error("Failed to migrate legacy workspaces:", err);
      return 0;
    }
  },
};

