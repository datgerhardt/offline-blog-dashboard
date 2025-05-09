import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { DatabaseService } from './database.service';
// import { ConnectivityService } from './connectivity.service';
import { SyncService } from './sync.service';
import { Post, SyncOperation, SyncStatus } from '../models/interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private apiUrl = 'https://jsonplaceholder.typicode.com/posts';
  private postsSubject = new BehaviorSubject<Post[]>([]);
  public posts$ = this.postsSubject.asObservable();
  
  constructor(
    private http: HttpClient,
    private db: DatabaseService,
    // private connectivityService: ConnectivityService,
    // private syncService: SyncService
  ) {
    this.loadFromIndexedDB();
    
    // Subscribe to connectivity changes
    // this.connectivityService.online$.subscribe(isOnline => {
    //   if (isOnline) {
    //     // this.syncService.syncPendingOperations();
    //   }
    // });
  }
  
  private async loadFromIndexedDB(): Promise<void> {
    const posts = await this.db.posts.toArray();
    this.postsSubject.next(posts);
  }
  
  getAllPosts(): Observable<Post[]> {
    return from(this.db.posts.toArray());
  }
  
  getPost(id: number): Observable<Post | undefined> {
    return from(this.db.posts.get(id));
  }
  
  searchPosts(query: string): Observable<Post[]> {
    const lowerQuery = query.toLowerCase();
    return from(this.db.posts
      .filter(post => 
        post.title.toLowerCase().includes(lowerQuery) || 
        post.body.toLowerCase().includes(lowerQuery)
      )
      .toArray());
  }
  
  createPost(post: Omit<Post, 'id' | 'syncStatus' | 'updatedAt'>): Observable<Post> {
    const isOnline = true // this.connectivityService.isOnline;
    const timestamp = Date.now();
    
    // Create temporary ID for offline mode (negative to avoid conflicts with API)
    const tempId = isOnline ? undefined : -Math.floor(Math.random() * 1000000);
    
    const newPost: Post = {
      ...post,
      id: tempId,
      syncStatus: isOnline ? SyncStatus.SYNCED : SyncStatus.PENDING,
      updatedAt: timestamp
    };
    
    if (isOnline) {
      return this.http.post<Post>(this.apiUrl, post).pipe(
        map(response => ({
          ...response,
          syncStatus: SyncStatus.SYNCED,
          updatedAt: timestamp
        })),
        tap(async serverPost => {
          await this.db.posts.put(serverPost);
          await this.loadFromIndexedDB();
        }),
        catchError(error => {
          console.error('Error creating post in API:', error);
          this.addToSyncQueue('create', 'post', newPost);
          return of(newPost);
        })
      );
    } else {
      return from(
        this.db.posts.put(newPost)
          .then(() => {
            this.addToSyncQueue('create', 'post', newPost);
            this.loadFromIndexedDB();
            return newPost;
          })
      );
    }
  }
  
  updatePost(id: number, updates: Partial<Post>): Observable<Post> {
    const isOnline = false // this.connectivityService.isOnline;
    const timestamp = Date.now();
    
    return from(this.db.posts.get(id).then(async existingPost => {
      if (!existingPost) {
        throw new Error(`Post with ID ${id} not found`);
      }
      
      const updatedPost: Post = {
        ...existingPost,
        ...updates,
        syncStatus: isOnline ? SyncStatus.SYNCED : SyncStatus.PENDING,
        updatedAt: timestamp
      };
      
      await this.db.posts.put(updatedPost);
      this.loadFromIndexedDB();
      
      if (isOnline) {
        try {
          const response = await this.http.put<Post>(`${this.apiUrl}/${id}`, updatedPost).toPromise();
          return {
            ...response,
            userId: existingPost.userId,
            title: existingPost.title,
            body: existingPost.body,
            syncStatus: SyncStatus.SYNCED,
            updatedAt: timestamp
          };
        } catch (error) {
          console.error('Error updating post in API:', error);
          this.addToSyncQueue('update', 'post', updatedPost);
          return updatedPost;
        }
      } else {
        this.addToSyncQueue('update', 'post', updatedPost);
        return updatedPost;
      }
    }));
  }
  
  deletePost(id: number): Observable<boolean> {
    const isOnline = true // this.connectivityService.isOnline;
    
    return from(this.db.posts.get(id).then(async existingPost => {
      if (!existingPost) {
        throw new Error(`Post with ID ${id} not found`);
      }
      
      await this.db.posts.delete(id);
      this.loadFromIndexedDB();
      
      if (isOnline) {
        try {
          await this.http.delete(`${this.apiUrl}/${id}`).toPromise();
          return true;
        } catch (error) {
          console.error('Error deleting post from API:', error);
          this.addToSyncQueue('delete', 'post', existingPost);
          return true;
        }
      } else {
        this.addToSyncQueue('delete', 'post', existingPost);
        return true;
      }
    }));
  }
  
  // Add operation to sync queue
  private async addToSyncQueue(type: 'create' | 'update' | 'delete', entity: 'post', data: any): Promise<void> {
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