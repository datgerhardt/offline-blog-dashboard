import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CommentService } from './comment.service';
import { DatabaseService } from './database.service';
import { SyncService } from './sync.service';
import { Comment, SyncStatus } from '../models/interfaces';
import { Table } from 'dexie';

describe('CommentService', () => {
  let service: CommentService;
  let httpMock: HttpTestingController;
  let dbServiceMock: DatabaseService;
  let syncServiceMock: SyncService;

  const mockComments: Comment[] = [
    { 
      id: 1, 
      postId: 1, 
      name: 'Test User 1', 
      email: 'user1@example.com', 
      body: 'This is test comment 1', 
      syncStatus: SyncStatus.SYNCED, 
      updatedAt: 1620000000000 
    },
    { 
      id: 2, 
      postId: 1, 
      name: 'Test User 2', 
      email: 'user2@example.com', 
      body: 'This is test comment 2', 
      syncStatus: SyncStatus.SYNCED, 
      updatedAt: 1620000000000 
    },
    { 
      id: 3, 
      postId: 2, 
      name: 'Test User 3', 
      email: 'user3@example.com', 
      body: 'This is test comment 3', 
      syncStatus: SyncStatus.SYNCED, 
      updatedAt: 1620000000000 
    }
  ];

  beforeEach(() => {
    const mockCommentsTable = {
      toArray: jasmine.createSpy('toArray').and.returnValue(Promise.resolve(mockComments)),
      get: jasmine.createSpy('get').and.callFake((id: number) => 
        Promise.resolve(mockComments.find(comment => comment.id === id))
      ),
      put: jasmine.createSpy('put').and.returnValue(Promise.resolve()),
      delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
      where: jasmine.createSpy('where').and.returnValue({
        equals: (postId: number) => ({
          toArray: () => Promise.resolve(mockComments.filter(comment => comment.postId === postId))
        })
      }),
      filter: jasmine.createSpy('filter').and.callFake((predicate) => ({
        toArray: () => Promise.resolve(mockComments.filter(comment => 
          comment.email.toLowerCase().includes('user') || 
          comment.body.toLowerCase().includes('test')))
      }))
    } as unknown as Table<Comment, number>;

    const mockSyncQueue = {
      add: jasmine.createSpy('add').and.returnValue(Promise.resolve())
    } as unknown as Table<any, string>;

    dbServiceMock = {
      comments: mockCommentsTable,
      syncQueue: mockSyncQueue
    } as unknown as DatabaseService;

    syncServiceMock = {} as SyncService;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CommentService,
        { provide: DatabaseService, useValue: dbServiceMock },
        { provide: SyncService, useValue: syncServiceMock }
      ]
    });

    service = TestBed.inject(CommentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load comments from IndexedDB on initialization', (done) => {
    service.comments$.subscribe(comments => {
      expect(comments).toEqual(mockComments);
      expect(dbServiceMock.comments.toArray).toHaveBeenCalled();
      done();
    });
  });

  describe('getAllComments', () => {
    it('should return all comments from IndexedDB', (done) => {
      service.getAllComments().subscribe(comments => {
        expect(comments).toEqual(mockComments);
        expect(dbServiceMock.comments.toArray).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('getCommentsByPostId', () => {
    it('should return comments for a specific post ID', (done) => {
      const postId = 1;
      const expectedComments = mockComments.filter(comment => comment.postId === postId);
      
      service.getCommentsByPostId(postId).subscribe(comments => {
        expect(comments.length).toBe(2);
        expect(dbServiceMock.comments.where).toHaveBeenCalledWith({ postId });
        done();
      });
    });
  });

  describe('searchComments', () => {
    it('should filter comments by search query', (done) => {
      service.searchComments('test').subscribe(comments => {
        expect(comments).toBeTruthy();
        expect(dbServiceMock.comments.filter).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('createComment', () => {
    const newCommentData = {
      postId: 1,
      name: 'New User',
      email: 'newuser@example.com',
      body: 'This is a new comment'
    };

    const createdComment: Comment = {
      id: 4,
      postId: 1,
      name: 'New User',
      email: 'newuser@example.com',
      body: 'This is a new comment',
      syncStatus: SyncStatus.SYNCED,
      updatedAt: jasmine.any(Number) as any
    };

    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(1620000000000));
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should create a comment when online and API request succeeds', (done) => {
      service.createComment(newCommentData).subscribe(comment => {
        expect(comment.id).toBe(4);
        expect(comment.name).toBe('New User');
        expect(comment.syncStatus).toBe(SyncStatus.SYNCED);
        done();
      });

      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments');
      expect(req.request.method).toBe('POST');
      req.flush(createdComment);
    });

    it('should handle API errors when creating a comment', (done) => {
      service.createComment(newCommentData).subscribe(comment => {
        expect(comment.name).toBe('New User');
        expect(comment.syncStatus).toBe(SyncStatus.PENDING);
        expect(dbServiceMock.syncQueue.add).toHaveBeenCalled();
        done();
      });

      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments');
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('updateComment', () => {
    const updateData = {
      body: 'Updated comment body'
    };

    it('should update a comment when online and API request succeeds', (done) => {
      const updatedComment = {
        ...mockComments[0],
        ...updateData,
        syncStatus: SyncStatus.SYNCED,
        updatedAt: 1620000000000
      };

      service.updateComment(1, updateData).subscribe(comment => {
        expect(comment.body).toBe('Updated comment body');
        expect(comment.syncStatus).toBe(SyncStatus.SYNCED);
        done();
      });

      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments/1');
      expect(req.request.method).toBe('PUT');
      req.flush(updatedComment);
    });

    it('should handle API errors when updating a comment', (done) => {
      service.updateComment(1, updateData).subscribe(comment => {
        expect(comment.body).toBe('Updated comment body');
        expect(comment.syncStatus).toBe(SyncStatus.PENDING);
        expect(dbServiceMock.syncQueue.add).toHaveBeenCalled();
        done();
      });

      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments/1');
      req.error(new ErrorEvent('Network error'));
    });

    it('should throw error when trying to update non-existent comment', (done) => {
      service.updateComment(999, updateData).subscribe(
        () => {
          fail('Should not succeed');
          done();
        },
        error => {
          expect(error.message).toContain('not found');
          done();
        }
      );
    });
  });

  describe('deleteComment', () => {
    it('should delete a comment when online and API request succeeds', (done) => {
      service.deleteComment(1).subscribe(result => {
        expect(result).toBe(true);
        expect(dbServiceMock.comments.delete).toHaveBeenCalledWith(1);
        done();
      });

      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments/1');
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('should handle API errors when deleting a comment', (done) => {
      service.deleteComment(1).subscribe(result => {
        expect(result).toBe(true);
        expect(dbServiceMock.syncQueue.add).toHaveBeenCalled();
        done();
      });

      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/comments/1');
      req.error(new ErrorEvent('Network error'));
    });

    it('should throw error when trying to delete non-existent comment', (done) => {
      (dbServiceMock.comments.get as jasmine.Spy).and.returnValue(Promise.resolve(undefined));
      
      service.deleteComment(999).subscribe(
        () => {
          fail('Should not succeed');
          done();
        },
        error => {
          expect(error.message).toContain('not found');
          done();
        }
      );
    });
  });
});