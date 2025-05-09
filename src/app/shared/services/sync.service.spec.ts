import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SyncService } from './sync.service';
import { DatabaseService } from './database.service';
import { SyncOperation, SyncStatus } from '../models/interfaces';
import { Table } from 'dexie';
import { of } from 'rxjs';

describe('SyncService', () => {
  let service: SyncService;
  let httpMock: HttpTestingController;
  let dbServiceMock: DatabaseService;

  // Mock data for tests
  const mockPendingOperations: SyncOperation[] = [
    {
      id: '1',
      type: 'create',
      entity: 'post',
      data: {
        id: -1,
        userId: 1,
        title: 'New Post',
        body: 'This is a new post',
        syncStatus: SyncStatus.PENDING,
        updatedAt: 1620000000000
      },
      timestamp: 1620000000000,
      retryCount: 0
    },
    {
      id: '2',
      type: 'update',
      entity: 'comment',
      data: {
        id: 5,
        postId: 1,
        name: 'Test User',
        email: 'test@example.com',
        body: 'Updated comment',
        syncStatus: SyncStatus.PENDING,
        updatedAt: 1620000000000
      },
      timestamp: 1620000000001,
      retryCount: 0
    },
    {
      id: '3',
      type: 'delete',
      entity: 'post',
      data: {
        id: 10,
        userId: 1,
        title: 'Post to Delete',
        body: 'This post will be deleted',
        syncStatus: SyncStatus.PENDING,
        updatedAt: 1620000000000
      },
      timestamp: 1620000000002,
      retryCount: 0
    }
  ];

  // Mock API responses
  const mockApiPosts = [
    { id: 1, userId: 1, title: 'Post 1', body: 'Content 1', syncStatus: SyncStatus.SYNCED, updatedAt: 1620000000000 },
    { id: 2, userId: 1, title: 'Post 2', body: 'Content 2', syncStatus: SyncStatus.SYNCED, updatedAt: 1620000000000 }
  ];

  const mockApiComments = [
    { id: 1, postId: 1, name: 'User 1', email: 'user1@example.com', body: 'Comment 1', syncStatus: SyncStatus.SYNCED, updatedAt: 1620000000000 },
    { id: 2, postId: 1, name: 'User 2', email: 'user2@example.com', body: 'Comment 2', syncStatus: SyncStatus.SYNCED, updatedAt: 1620000000000 }
  ];

  const mockApiUsers = [
    { id: 1, name: 'User Name', email: 'user@example.com', username: 'username1' }
  ];

  beforeEach(() => {
    // Create mock for DatabaseService
    const mockSyncQueueTable = {
      orderBy: jasmine.createSpy('orderBy').and.returnValue({
        toArray: () => Promise.resolve(mockPendingOperations)
      }),
      delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
      put: jasmine.createSpy('put').and.returnValue(Promise.resolve())
    } as unknown as Table<SyncOperation, string>;

    const mockPostsTable = {
      get: jasmine.createSpy('get').and.returnValue(Promise.resolve({ id: 1 })),
      delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
      put: jasmine.createSpy('put').and.returnValue(Promise.resolve()),
      update: jasmine.createSpy('update').and.returnValue(Promise.resolve())
    } as unknown as Table<any, number>;

    const mockCommentsTable = {
      get: jasmine.createSpy('get').and.returnValue(Promise.resolve({ id: 5 })),
      delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
      put: jasmine.createSpy('put').and.returnValue(Promise.resolve()),
      update: jasmine.createSpy('update').and.returnValue(Promise.resolve())
    } as unknown as Table<any, number>;

    dbServiceMock = {
      syncQueue: mockSyncQueueTable,
      posts: mockPostsTable,
      comments: mockCommentsTable,
      initializeFromApi: jasmine.createSpy('initializeFromApi').and.returnValue(Promise.resolve())
    } as unknown as DatabaseService;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SyncService,
        { provide: DatabaseService, useValue: dbServiceMock }
      ]
    });

    service = TestBed.inject(SyncService);
    httpMock = TestBed.inject(HttpTestingController);

    // Setup date mocking
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(1620000000000));
  });

  afterEach(() => {
    httpMock.verify();
    jasmine.clock().uninstall();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('syncInProgress$', () => {
    it('should initially be false', (done) => {
      service.syncInProgress$.subscribe(value => {
        expect(value).toBeFalse();
        done();
      });
    });
  });

  describe('syncPendingOperations', () => {
    it('should not start a new sync if one is already in progress', async () => {
      // Set sync in progress
      (service as any).syncInProgressSubject.next(true);
      
      await service.syncPendingOperations();
      
      // Verify no operations were processed
      expect(dbServiceMock.syncQueue.orderBy).not.toHaveBeenCalled();
    });

    it('should process all pending operations in order', async () => {
      spyOn(service as any, 'processOperation').and.returnValue(Promise.resolve());
      
      await service.syncPendingOperations();
      
      expect((service as any).processOperation).toHaveBeenCalledTimes(3);
      expect((service as any).processOperation).toHaveBeenCalledWith(mockPendingOperations[0]);
      expect((service as any).processOperation).toHaveBeenCalledWith(mockPendingOperations[1]);
      expect((service as any).processOperation).toHaveBeenCalledWith(mockPendingOperations[2]);
    });

    it('should set sync status to false when complete', async () => {
      spyOn(service as any, 'processOperation').and.returnValue(Promise.resolve());
      
      let syncStatus: boolean | undefined;
      service.syncInProgress$.subscribe(value => {
        syncStatus = value;
      });
      
      await service.syncPendingOperations();
      
      expect(syncStatus).toBeFalse();
    });

    it('should handle errors in processing operations', async () => {
      spyOn(service as any, 'processOperation').and.callFake((op: SyncOperation) => {
        if (op.id === '2') {
          return Promise.reject(new Error('Test error'));
        }
        return Promise.resolve();
      });
      
      await service.syncPendingOperations();
      
      // Should update retry count for failed operation
      expect(dbServiceMock.syncQueue.put).toHaveBeenCalled();
      
      // Should continue processing other operations
      expect((service as any).processOperation).toHaveBeenCalledTimes(3);
    });

    it('should mark items as failed after 3 retries', async () => {
      // Modify the second operation to have 2 retries already
      const failingOp = { ...mockPendingOperations[1], retryCount: 2 };
      (dbServiceMock.syncQueue.orderBy as jasmine.Spy).and.returnValue({
        toArray: () => Promise.resolve([mockPendingOperations[0], failingOp, mockPendingOperations[2]])
      });
      
      spyOn(service as any, 'processOperation').and.callFake((op: SyncOperation) => {
        if (op.id === '2') {
          return Promise.reject(new Error('Test error'));
        }
        return Promise.resolve();
      });
      
      await service.syncPendingOperations();
      
      // Should mark comment as failed
      expect(dbServiceMock.comments.update).toHaveBeenCalledWith(5, { syncStatus: SyncStatus.FAILED });
      
      // Should delete failed operation from queue
      expect(dbServiceMock.syncQueue.delete).toHaveBeenCalledWith('2');
    });
  });

  describe('processOperation', () => {
    it('should process post operations', async () => {
      spyOn(service as any, 'processPostOperation').and.returnValue(Promise.resolve());
      
      await (service as any).processOperation(mockPendingOperations[0]);
      
      expect((service as any).processPostOperation).toHaveBeenCalledWith(mockPendingOperations[0]);
    });
    
    it('should process comment operations', async () => {
      spyOn(service as any, 'processCommentOperation').and.returnValue(Promise.resolve());
      
      await (service as any).processOperation(mockPendingOperations[1]);
      
      expect((service as any).processCommentOperation).toHaveBeenCalledWith(mockPendingOperations[1]);
    });
    
    it('should throw error on unknown entity', async () => {
      const invalidOp = { ...mockPendingOperations[0], entity: 'unknown' };
      
      try {
        await (service as any).processOperation(invalidOp);
        fail('Should have thrown error');
      } catch (error: unknown) {
        expect((error as Error).message).toContain('Unknown entity type');
      }
    });
  });
  
  describe('processPostOperation', () => {
    it('should handle create operation for posts', async () => {
      const createOp = mockPendingOperations[0];
      const serverResponse = { id: 101, ...createOp.data };
      
      const result = (service as any).processPostOperation(createOp);
      
      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/posts');
      expect(req.request.method).toBe('POST');
      req.flush(serverResponse);
      
      await result;
      
      // Should delete temporary post
      expect(dbServiceMock.posts.delete).toHaveBeenCalledWith(-1);
      
      // Should save server post
      expect(dbServiceMock.posts.put).toHaveBeenCalled();
    });
    
    it('should handle update operation for posts', async () => {
      const updateOp = { ...mockPendingOperations[0], type: 'update', data: { ...mockPendingOperations[0].data, id: 5 } };
      
      const result = (service as any).processPostOperation(updateOp);
      
      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/posts/5');
      expect(req.request.method).toBe('PUT');
      req.flush({});
      
      await result;
      
      // Should update post in DB
      expect(dbServiceMock.posts.put).toHaveBeenCalled();
    });
    
    it('should handle delete operation for posts', async () => {
      const deleteOp = mockPendingOperations[2];
      
      const result = (service as any).processPostOperation(deleteOp);
      
      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/posts/10');
      expect(req.request.method).toBe('DELETE');
      req.flush({});
      
      const success = await result;
      expect(success).toBeTrue();
    });
    
    it('should throw error on unknown operation type', async () => {
      const invalidOp = { ...mockPendingOperations[0], type: 'unknown' };
      
      try {
        await (service as any).processPostOperation(invalidOp);
        fail('Should have thrown error');
      } catch (error: unknown) {
        expect((error as Error).message).toContain('Unknown operation type');
      }
    });
  });
  describe('processCommentOperation', () => {
    it('should handle create operation for comments', async () => {
      const createOp = { ...mockPendingOperations[1], type: 'create', data: { ...mockPendingOperations[1].data, id: -5 } };
      const serverResponse = { id: 101, ...createOp.data };
      
      const result = (service as any).processCommentOperation(createOp);
      
      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments');
      expect(req.request.method).toBe('POST');
      req.flush(serverResponse);
      
      await result;
      
      // Should delete temporary comment
      expect(dbServiceMock.comments.delete).toHaveBeenCalledWith(-5);
      
      // Should save server comment
      expect(dbServiceMock.comments.put).toHaveBeenCalled();
    });
    
    it('should handle update operation for comments', async () => {
      const updateOp = mockPendingOperations[1];
      
      const result = (service as any).processCommentOperation(updateOp);
      
      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments/5');
      expect(req.request.method).toBe('PUT');
      req.flush({});
      
      await result;
      
      // Should update comment in DB
      expect(dbServiceMock.comments.put).toHaveBeenCalled();
    });
    
    it('should handle delete operation for comments', async () => {
      const deleteOp = { ...mockPendingOperations[1], type: 'delete' };
      
      const result = (service as any).processCommentOperation(deleteOp);
      
      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments/5');
      expect(req.request.method).toBe('DELETE');
      req.flush({});
      
      const success = await result;
      expect(success).toBeTrue();
    });
  });
  
  describe('initialSync', () => {
    it('should fetch data from all APIs and initialize the database', async () => {
      const promise = service.initialSync();
      
      const postsReq = httpMock.expectOne('https://jsonplaceholder.typicode.com/posts');
      const commentsReq = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments');
      const usersReq = httpMock.expectOne('https://jsonplaceholder.typicode.com/users');
      
      postsReq.flush(mockApiPosts);
      commentsReq.flush(mockApiComments);
      usersReq.flush(mockApiUsers);
      
      await promise;
      
      expect(dbServiceMock.initializeFromApi).toHaveBeenCalledWith(
        mockApiPosts,
        mockApiComments,
        mockApiUsers
      );
    });
    
    it('should handle API errors during initial sync', async () => {
      const promise = service.initialSync();
      
      const postsReq = httpMock.expectOne('https://jsonplaceholder.typicode.com/posts');
      const commentsReq = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments');
      const usersReq = httpMock.expectOne('https://jsonplaceholder.typicode.com/users');
      
      postsReq.flush(mockApiPosts);
      commentsReq.error(new ErrorEvent('Network error'));
      usersReq.flush(mockApiUsers);
      
      try {
        await promise;
        fail('Should have thrown error');
      } catch (error: unknown) {
        expect((error as Error).message).toContain('Failed to fetch data');
        expect(dbServiceMock.initializeFromApi).not.toHaveBeenCalled();
      }
    });
    
    it('should throw error if any API response is null', async () => {
      const promise = service.initialSync();
      
      const postsReq = httpMock.expectOne('https://jsonplaceholder.typicode.com/posts');
      const commentsReq = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments');
      const usersReq = httpMock.expectOne('https://jsonplaceholder.typicode.com/users');
      
      postsReq.flush(null);
      commentsReq.flush(mockApiComments);
      usersReq.flush(mockApiUsers);
      
      try {
        await promise;
        fail('Should have thrown error');
      } catch (error: unknown) {
        expect((error as Error).message).toContain('Failed to fetch data');
        expect(dbServiceMock.initializeFromApi).not.toHaveBeenCalled();
      }
    });
  });
  
  describe('getData', () => {
    it('should resolve with the provided data', async () => {
      const testData = [1, 2, 3];
      const result = await service.getData(testData);
      expect(result).toEqual(testData);
    });
  });
});