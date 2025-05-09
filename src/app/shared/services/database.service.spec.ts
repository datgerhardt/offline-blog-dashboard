import { TestBed } from '@angular/core/testing';
import { DatabaseService } from './database.service';
import { Post, Comment, User, SyncStatus, SyncOperation } from '../models/interfaces';
import { Table } from 'dexie';

describe('DatabaseService', () => {
  let service: DatabaseService;

  const mockPosts: Post[] = [
    { id: 1, userId: 1, title: 'Test Post 1', body: 'This is test post 1', syncStatus: SyncStatus.SYNCED, updatedAt: 1620000000000 },
    { id: 2, userId: 1, title: 'Test Post 2', body: 'This is test post 2', syncStatus: SyncStatus.SYNCED, updatedAt: 1620000000000 }
  ];

  const mockComments: Comment[] = [
    { id: 1, postId: 1, name: 'User 1', email: 'user1@example.com', body: 'Comment 1', syncStatus: SyncStatus.SYNCED, updatedAt: 1620000000000 },
    { id: 2, postId: 1, name: 'User 2', email: 'user2@example.com', body: 'Comment 2', syncStatus: SyncStatus.SYNCED, updatedAt: 1620000000000 }
  ];

  const mockUsers: User[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', username: 'johndoe' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', username: 'janesmith' }
  ];

  const mockTable = {
    bulkPut: jasmine.createSpy('bulkPut').and.returnValue(Promise.resolve()),
    toArray: jasmine.createSpy('toArray').and.returnValue(Promise.resolve([])),
    put: jasmine.createSpy('put').and.returnValue(Promise.resolve()),
    delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
    where: jasmine.createSpy('where').and.returnValue({
      equals: jasmine.createSpy('equals').and.returnValue({
        toArray: jasmine.createSpy('toArray').and.returnValue(Promise.resolve([]))
      })
    }),
    filter: jasmine.createSpy('filter').and.returnValue({
      toArray: jasmine.createSpy('toArray').and.returnValue(Promise.resolve([]))
    })
  } as unknown as Table<any, number>;

  const mockSyncQueueTable = {
    ...mockTable,
    add: jasmine.createSpy('add').and.returnValue(Promise.resolve())
  } as unknown as Table<SyncOperation, string>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DatabaseService]
    });

    service = TestBed.inject(DatabaseService);

    // Manually assign mocked tables
    service.posts = mockTable;
    service.comments = mockTable;
    service.users = mockTable;
    service.syncQueue = mockSyncQueueTable;

    spyOn(service as any, 'transaction').and.callFake((mode: string, tables: any[], callback: Function) => callback());

    spyOn(Date, 'now').and.returnValue(1620000000000);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initializeFromApi', () => {
    it('should store posts with syncStatus and updatedAt', async () => {
      await service.initializeFromApi(mockPosts, [], []);
      expect(service.posts.bulkPut).toHaveBeenCalledWith(mockPosts);
    });

    it('should store comments with syncStatus and updatedAt', async () => {
      await service.initializeFromApi([], mockComments, []);
      expect(service.comments.bulkPut).toHaveBeenCalledWith(mockComments);
    });

    it('should store users without transformation', async () => {
      await service.initializeFromApi([], [], mockUsers);
      expect(service.users.bulkPut).toHaveBeenCalledWith(mockUsers);
    });

    it('should perform all operations in one transaction', async () => {
      await service.initializeFromApi(mockPosts, mockComments, mockUsers);
      expect(service.transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle empty arrays without error', async () => {
      await service.initializeFromApi([], [], []);
      expect(service.posts.bulkPut).toHaveBeenCalledWith([]);
      expect(service.comments.bulkPut).toHaveBeenCalledWith([]);
      expect(service.users.bulkPut).toHaveBeenCalledWith([]);
    });

    it('should throw error if transaction fails', async () => {
      (service.transaction as jasmine.Spy).and.throwError('Transaction failed');
      await expectAsync(service.initializeFromApi(mockPosts, mockComments, mockUsers)).toBeRejectedWithError('Transaction failed');
    });

    it('should throw error if bulkPut fails', async () => {
      (service.posts.bulkPut as jasmine.Spy).and.returnValue(Promise.reject(new Error('bulkPut error')));
      await expectAsync(service.initializeFromApi(mockPosts, mockComments, mockUsers)).toBeRejectedWithError('bulkPut error');
    });
  });

  describe('Table access', () => {
    it('should have posts table defined', () => {
      expect(service.posts).toBe(mockTable);
    });

    it('should have comments table defined', () => {
      expect(service.comments).toBe(mockTable);
    });

    it('should have users table defined', () => {
      expect(service.users).toBe(mockTable);
    });

    it('should have syncQueue table defined', () => {
      expect(service.syncQueue).toBe(mockSyncQueueTable);
    });
  });
});