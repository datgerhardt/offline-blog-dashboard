import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, map, tap, catchError, of } from 'rxjs';
import { User, SyncStatus, SyncOperation } from '../models/interfaces';
import { DatabaseService } from './database.service';
import { v4 as uuidv4 } from 'uuid';


@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'https://jsonplaceholder.typicode.com/users';
  private usersSubject = new BehaviorSubject<User[]>([]);
  public users$ = this.usersSubject.asObservable();
  
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
    const users = await this.db.users.toArray();
    this.usersSubject.next(users);
  }
  
  getAllUsers(): Observable<User[]> {
    return from(this.db.users.toArray());
  }
  
  getUser(id: number): Observable<User | undefined> {
    return from(this.db.users.get(id));
  }
  
  createUser(user: Omit<User, 'id' | 'syncStatus' | 'updatedAt'>): Observable<User> {
    const isOnline = true // this.connectivityService.isOnline;
    const timestamp = Date.now();
    
    const tempId = -Math.floor(Math.random() * 1000000);
    
    const newUser: User = {
      ...user,
      id: tempId,
    };
    
    if (isOnline) {
      return this.http.post<User>(this.apiUrl, user).pipe(
        map(response => ({
          ...response,
          syncStatus: SyncStatus.SYNCED,
          updatedAt: timestamp
        })),
        tap(async serverUser => {
          await this.db.users.put(serverUser);
          await this.loadFromIndexedDB();
        }),
        catchError(error => {
          console.error('Error creating user in API:', error);
          this.addToSyncQueue('create', 'user', newUser);
          return of(newUser);
        })
      );
    } else {
      return from(
        this.db.users.put(newUser)
          .then(() => {
            this.addToSyncQueue('create', 'user', newUser);
            this.loadFromIndexedDB();
            return newUser;
          })
      );
    }
  }
  
  
  // Add operation to sync queue
  private async addToSyncQueue(type: 'create' | 'update' | 'delete', entity: 'user', data: any): Promise<void> {
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

