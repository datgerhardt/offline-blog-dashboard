import Dexie from 'dexie';
import { Injectable } from '@angular/core';
import { Post, Comment, User, SyncOperation, SyncStatus } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService extends Dexie {
  posts: Dexie.Table<Post, number>;
  comments: Dexie.Table<Comment, number>;
  users: Dexie.Table<User, number>;
  syncQueue: Dexie.Table<SyncOperation, string>;

  constructor() {
    super('BlogDatabase');
    
    this.version(1).stores({
      posts: 'id, userId, title, body, syncStatus, updatedAt',
      comments: 'id, postId, name, email, body, syncStatus, updatedAt',
      users: 'id, name, email, username',
      syncQueue: 'id, type, entity, timestamp, retryCount'
    });
    
    this.posts = this.table('posts');
    this.comments = this.table('comments');
    this.users = this.table('users');
    this.syncQueue = this.table('syncQueue');
  }

  async initializeFromApi( posts: Post[], comments: Comment[], users: User[]): Promise<void> {
    await this.transaction('rw', [this.posts, this.comments, this.users], async () => {
      const syncedPosts = posts.map(post => ({
        ...post,
        syncStatus: SyncStatus.SYNCED,
        updatedAt: Date.now()
      }));
      
      const syncedComments = comments.map(comment => ({
        ...comment,
        syncStatus: SyncStatus.SYNCED,
        updatedAt: Date.now()
      }));
      
      await this.posts.bulkPut(syncedPosts);
      await this.comments.bulkPut(syncedComments);
      await this.users.bulkPut(users);
    });
  }
}