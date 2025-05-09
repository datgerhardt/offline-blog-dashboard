import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatabaseService } from './database.service';
import { Post, SyncOperation, SyncStatus } from '../models/interfaces';
import { BehaviorSubject, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private postsApiUrl = 'https://jsonplaceholder.typicode.com/posts';
  private commentsApiUrl = 'https://jsonplaceholder.typicode.com/comments';
  private  usersApiUrl = 'https://jsonplaceholder.typicode.com/users';

  private syncInProgressSubject = new BehaviorSubject<boolean>(false);
  public syncInProgress$ = this.syncInProgressSubject.asObservable();

  constructor(
    private http: HttpClient,
    private db: DatabaseService
  ) { }

// Sync pending operations from the queue
  async syncPendingOperations(): Promise<void> {
    if (this.syncInProgressSubject.value) {
      return; 
    }

    this.syncInProgressSubject.next(true);

    try {
      const pendingOps = await this.db.syncQueue
        .orderBy('timestamp')
        .toArray();

      for (const op of pendingOps) {
        try {
          await this.processOperation(op);
          await this.db.syncQueue.delete(op.id);
        } catch (error) {
          console.error(`Error processing operation ${op.id}:`, error);

          const updatedOp: SyncOperation = {
            ...op,
            retryCount: op.retryCount + 1
          };

          if (updatedOp.retryCount >= 3) {
            if (op.entity === 'post' && op.data.id) {
              const post = await this.db.posts.get(op.data.id);
              if (post) {
                await this.db.posts.update(post.id!, { syncStatus: SyncStatus.FAILED });
              }
            } else if (op.entity === 'comment' && op.data.id) {
              const comment = await this.db.comments.get(op.data.id);
              if (comment) {
                await this.db.comments.update(comment.id!, { syncStatus: SyncStatus.FAILED });
              }
            }

            await this.db.syncQueue.delete(op.id);
          } else {
            await this.db.syncQueue.put(updatedOp);
          }
        }
      }
    } finally {
      this.syncInProgressSubject.next(false);
    }
  }

  private async processOperation(op: SyncOperation): Promise<any> {
    switch (op.entity) {
      case 'post':
        return this.processPostOperation(op);
      case 'comment':
        return this.processCommentOperation(op);
      default:
        throw new Error(`Unknown entity type: ${op.entity}`);
    }
  }

  // Process post-related operations
  private async processPostOperation(op: SyncOperation): Promise<any> {
    const apiUrl = this.postsApiUrl;

    switch (op.type) {
      case 'create': {
        const isTemp = op.data.id && op.data.id < 0;

        const response = await this.http.post(apiUrl, {
          userId: op.data.userId,
          title: op.data.title,
          body: op.data.body
        }).toPromise();

        const serverPost = {
          userId: op.data.userId,
          title: op.data.title,
          body: op.data.body,
          syncStatus: SyncStatus.SYNCED,
          updatedAt: Date.now()
        };

        if (isTemp) {
          await this.db.posts.delete(op.data.id);
        }

        await this.db.posts.put(serverPost);
        return serverPost;
      }

      case 'update': {
        const response = await this.http.put(`${apiUrl}/${op.data.id}`, {
          id: op.data.id,
          userId: op.data.userId,
          title: op.data.title,
          body: op.data.body
        }).toPromise();

        const updatedPost = {
          userId: op.data.userId,
          title: op.data.title,
          body: op.data.body,
          syncStatus: SyncStatus.SYNCED,
          updatedAt: Date.now()
        };

        await this.db.posts.put(updatedPost);
        return updatedPost;
      }

      case 'delete': {
        await this.http.delete(`${apiUrl}/${op.data.id}`).toPromise();
        return true;
      }

      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  // Process comment-related operations
  private async processCommentOperation(op: SyncOperation): Promise<any> {
    const apiUrl = this.commentsApiUrl;

    switch (op.type) {
      case 'create': {
        const isTemp = op.data.id && op.data.id < 0;

        const response = await this.http.post(apiUrl, {
          postId: op.data.postId,
          name: op.data.name,
          email: op.data.email,
          body: op.data.body
        }).toPromise();

        const serverComment = {
          postId: op.data.postId,
          name: op.data.name,
          email: op.data.email,
          body: op.data.body,
          syncStatus: SyncStatus.SYNCED,
          updatedAt: Date.now()
        };

        if (isTemp) {
          await this.db.comments.delete(op.data.id);
        }

        await this.db.comments.put(serverComment);
        return serverComment;
      }

      case 'update': {
        const response = await this.http.put(`${apiUrl}/${op.data.id}`, {
          id: op.data.id,
          postId: op.data.postId,
          name: op.data.name,
          email: op.data.email,
          body: op.data.body
        }).toPromise();

        const updatedComment = {
          postId: op.data.postId,
          name: op.data.name,
          email: op.data.email,
          body: op.data.body,
          syncStatus: SyncStatus.SYNCED,
          updatedAt: Date.now()
        };

        await this.db.comments.put(updatedComment);
        return updatedComment;
      }

      case 'delete': {
        await this.http.delete(`${apiUrl}/${op.data.id}`).toPromise();
        return true;
      }

      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  getData(data: any): Promise<any[]> {
    return Promise.resolve(data); 
  }

  async initialSync(): Promise<void> {
    try {
      const [posts, comments, users] = await Promise.all([
        this.http.get<any[]>(this.postsApiUrl).toPromise(),
        this.http.get<any[]>(this.commentsApiUrl).toPromise(),
        this.http.get<any[]>(this.usersApiUrl).toPromise()
      ]);

      if (!posts || !comments || !users) {
        throw new Error('Failed to fetch data from API');
      }

      await this.db.initializeFromApi(posts as Post[], comments, users);
    } catch (error) {
      console.error('Error during initial sync:', error);
      throw error;
    }
  }
}