export interface Post {
  id?: number;
  userId: number;
  title: string;
  body: string;
  syncStatus: SyncStatus;
  updatedAt: number; // timestamp for conflict resolution
}

export interface Comment {
  id?: number;
  postId: number;
  name: string;
  email: string;
  body: string;
  syncStatus: SyncStatus;
  updatedAt: number;
}

export interface User {
  id?: number;
  name: string;
  email: string;
  username: string;
  website?: string;
}

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  FAILED = 'failed'
}

export interface SyncOperation {
  id: string; // unique identifier for operation
  type: 'create' | 'update' | 'delete';
  entity: 'post' | 'comment'| 'user';
  data: any; // Post or Comment data
  timestamp: number;
  retryCount: number;
}