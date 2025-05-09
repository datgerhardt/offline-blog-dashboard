
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { DatabaseService } from './database.service';
import { ConnectivityService } from './connectivity.service';
import { SyncService } from './sync.service';
import { Comment, SyncOperation, SyncStatus } from '../models/interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = 'https://jsonplaceholder.typicode.com/comments';
  private commentsSubject = new BehaviorSubject<Comment[]>([]);
  public comments$ = this.commentsSubject.asObservable();
  
  constructor(
    private http: HttpClient,
    private db: DatabaseService,
    // private connectivityService: ConnectivityService,
    private syncService: SyncService
  ) {
    this.loadFromIndexedDB();
  }
  
  private async loadFromIndexedDB(): Promise<void> {
    const comments = await this.db.comments.toArray();
    this.commentsSubject.next(comments);
  }
  
  // Get all comments
  getAllComments(): Observable<Comment[]> {
    return from(this.db.comments.toArray());
  }
  
  // Get comments for a specific post
  getCommentsByPostId(postId: number): Observable<Comment[]> {
    return from(this.db.comments
      .where('postId')
      .equals(postId)
      .toArray());
  }
  
  // Search comments by email or content
  searchComments(query: string): Observable<Comment[]> {
    const lowerQuery = query.toLowerCase();
    return from(this.db.comments
      .filter(comment => 
        comment.email.toLowerCase().includes(lowerQuery) || 
        comment.body.toLowerCase().includes(lowerQuery)
      )
      .toArray());
  }
  
  // Create a new comment
  createComment(comment: Omit<Comment, 'id' | 'syncStatus' | 'updatedAt'>): Observable<Comment> {
    const isOnline = true // this.connectivityService.isOnline;
    const timestamp = Date.now();
    
    // Create temporary ID for offline mode
    const tempId = isOnline ? undefined : -Math.floor(Math.random() * 1000000);
    
    const newComment: Comment = {
      ...comment,
      id: tempId,
      syncStatus: isOnline ? SyncStatus.SYNCED : SyncStatus.PENDING,
      updatedAt: timestamp
    };
    
    if (isOnline) {
      return this.http.post<Comment>(this.apiUrl, comment).pipe(
        map(response => ({
          ...response,
          syncStatus: SyncStatus.SYNCED,
          updatedAt: timestamp
        })),
        tap(async serverComment => {
          await this.db.comments.put(serverComment);
          await this.loadFromIndexedDB();
        }),
        catchError(error => {
          console.error('Error creating comment in API:', error);
          this.addToSyncQueue('create', 'comment', newComment);
          return of(newComment);
        })
      );
    } else {
      return from(
        this.db.comments.put(newComment)
          .then(() => {
            this.addToSyncQueue('create', 'comment', newComment);
            this.loadFromIndexedDB();
            return newComment;
          })
      );
    }
  }
  
  // Update existing comment
  updateComment(id: number, updates: Partial<Comment>): Observable<Comment> {
    const isOnline = true // this.connectivityService.isOnline;
    const timestamp = Date.now();
    
    return from(this.db.comments.get(id).then(async existingComment => {
      if (!existingComment) {
        throw new Error(`Comment with ID ${id} not found`);
      }
      
      const updatedComment: Comment = {
        ...existingComment,
        ...updates,
        syncStatus: isOnline ? SyncStatus.SYNCED : SyncStatus.PENDING,
        updatedAt: timestamp
      };
      
      // Always update IndexedDB first for optimistic UI
      await this.db.comments.put(updatedComment);
      this.loadFromIndexedDB();
      
      if (isOnline) {
        try {
          const response = await this.http.put<Comment>(`${this.apiUrl}/${id}`, updatedComment).toPromise();
          return {
            postId: existingComment.postId,
            name: existingComment.name,
            email: existingComment.email,
            body: existingComment.body,
            syncStatus: SyncStatus.SYNCED,
            updatedAt: timestamp
          };
        } catch (error) {
          console.error('Error updating comment in API:', error);
          this.addToSyncQueue('update', 'comment', updatedComment);
          return updatedComment;
        }
      } else {
        this.addToSyncQueue('update', 'comment', updatedComment);
        return updatedComment;
      }
    }));
  }
  
  // Delete a comment
  deleteComment(id: number): Observable<boolean> {
    const isOnline = true // this.connectivityService.isOnline;
    
    return from(this.db.comments.get(id).then(async existingComment => {
      if (!existingComment) {
        throw new Error(`Comment with ID ${id} not found`);
      }
      
      // For optimistic UI, remove from IndexedDB first
      await this.db.comments.delete(id);
      this.loadFromIndexedDB();
      
      if (isOnline) {
        try {
          await this.http.delete(`${this.apiUrl}/${id}`).toPromise();
          return true;
        } catch (error) {
          console.error('Error deleting comment from API:', error);
          this.addToSyncQueue('delete', 'comment', existingComment);
          return true;
        }
      } else {
        this.addToSyncQueue('delete', 'comment', existingComment);
        return true;
      }
    }));
  }
  
  // Add operation to sync queue
  private async addToSyncQueue(type: 'create' | 'update' | 'delete', entity: 'comment', data: any): Promise<void> {
    const operation: SyncOperation = {
      id: uuidv4(),
      type,
      entity,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    await this.db.syncQueue.add(operation);
  }
}
