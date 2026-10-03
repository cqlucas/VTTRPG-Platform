import Dexie, { type EntityTable } from 'dexie';

// ──────────────────────────────────────────────
// Local Database Interfaces
// ──────────────────────────────────────────────

export interface LocalCampaignData {
  id: string; // Synced with server Campaign ID
  name: string;
  gameSystem: string;
  lastAccessed: number;
  settings: Record<string, any>;
}

export interface LocalCharacter {
  id: string;
  campaignId: string;
  folderId?: string;
  name: string;
  portraitAssetId?: string;
  level: number;
  className?: string;
  race?: string;
  hitPointsMax: number;
  hitPointsCurrent: number;
  attributes: Record<string, number>;
  inventory: any[];
  features: string[];
  notes?: string;
  isNpc: boolean;
  ownerId: string; // Link to user ID
  createdAt: number;
  updatedAt: number;
}

export interface LocalFolder {
  id: string;
  campaignId: string;
  parentId?: string;
  name: string;
  type: 'character' | 'lore' | 'map';
  sortOrder: number;
}

export interface LocalLoreNode {
  id: string;
  campaignId: string;
  folderId?: string;
  title: string;
  content: string; // Markdown or Rich Text
  nodeType: string;
  coverAssetId?: string;
  isSecret: boolean;
  tags: string[];
  authorId: string;
  createdAt: number;
  updatedAt: number;
}

export interface LocalAsset {
  id: string;
  campaignId: string;
  name: string;
  mimeType: string;
  size: number;
  data: Blob | ArrayBuffer;
  createdAt: number;
}

// ──────────────────────────────────────────────
// Dexie Database Class
// ──────────────────────────────────────────────

export class QuestDreamerLocalDB extends Dexie {
  campaigns!: EntityTable<LocalCampaignData, 'id'>;
  characters!: EntityTable<LocalCharacter, 'id'>;
  folders!: EntityTable<LocalFolder, 'id'>;
  loreNodes!: EntityTable<LocalLoreNode, 'id'>;
  assets!: EntityTable<LocalAsset, 'id'>;

  constructor() {
    super('QuestDreamerLocalDB');
    
    this.version(1).stores({
      campaigns: 'id', // Primary key is id
      characters: 'id, campaignId, folderId, ownerId', // Indexed fields
      folders: 'id, campaignId, parentId, type',
      loreNodes: 'id, campaignId, folderId, authorId, nodeType',
      assets: 'id, campaignId, mimeType',
    });
  }
}

// Singleton instance
export const localDb = new QuestDreamerLocalDB();
