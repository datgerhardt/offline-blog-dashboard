import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PostService } from './post.service';
import { DatabaseService } from './database.service';
import { Post, SyncStatus } from '../models/interfaces';
import { of } from 'rxjs';
import { Table } from 'dexie';

describe('PostService', () => {
  let service: PostService;
  let httpMock: HttpTestingController;
  let dbServiceMock: DatabaseService;

  const mockPosts: Post[] = [
    { 
      id: 1, 
      userId: 1, 
      title: 'Test Post 1', 
      body: 'This is test post 1', 
      syncStatus: SyncStatus.SYNCED, 
      updatedAt: 1620000000000 
    },
    { 
      id: 2, 
      userId: 1, 
      title: 'Test Post 2', 
      body: 'This is test post 2', 
      syncStatus: SyncStatus.SYNCED, 
      updatedAt: 1620000000000 
    }
  ];

  beforeEach(() => {
    const mockTable = {
      toArray: jasmine.createSpy('toArray').and.returnValue(Promise.resolve(mockPosts)),
      get: jasmine.createSpy('get').and.callFake((id: number) => 
        Promise.resolve(mockPosts.find(post => post.id === id))
      ),
      put: jasmine.createSpy('put').and.returnValue(Promise.resolve()),
      delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
      filter: jasmine.createSpy('filter').and.returnValue({
        toArray: () => Promise.resolve(mockPosts.filter(post => 
          post.title.toLowerCase().includes('test') || 
          post.body.toLowerCase().includes('test')))
      })
    } as unknown as Table<Post, number>;

    const mockSyncQueue = {
      add: jasmine.createSpy('add').and.returnValue(Promise.resolve())
    } as unknown as Table<any, string>;

    dbServiceMock = {
      posts: mockTable,
      syncQueue: mockSyncQueue
    } as unknown as DatabaseService;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PostService,
        { provide: DatabaseService, useValue: dbServiceMock }
      ]
    });

    service = TestBed.inject(PostService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load posts from IndexedDB on initialization', (done) => {
    service.posts$.subscribe(posts => {
      expect(posts).toEqual(mockPosts);
      expect(dbServiceMock.posts.toArray).toHaveBeenCalled();
      done();
    });
  });

  describe('getAllPosts', () => {
    it('should return all posts from IndexedDB', (done) => {
      service.getAllPosts().subscribe(posts => {
        expect(posts).toEqual(mockPosts);
        expect(dbServiceMock.posts.toArray).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('getPost', () => {
    it('should return a specific post by ID', (done) => {
      service.getPost(1).subscribe(post => {
        expect(post).toEqual(mockPosts[0]);
        done();
      });
    });

    it('should return undefined for non-existent post', (done) => {
      service.getPost(999).subscribe(post => {
        expect(post).toBeUndefined();
        done();
      });
    });
  });

  describe('searchPosts', () => {
    it('should filter posts by search query', (done) => {
      service.searchPosts('test').subscribe(posts => {
        expect(posts).toEqual(mockPosts);
        done();
      });
    });
  });

  describe('createPost', () => {
    const newPostData = {
      userId: 1,
      title: 'New Post',
      body: 'This is a new post'
    };

    const createdPost: Post = {
      id: 3,
      userId: 1,
      title: 'New Post',
      body: 'This is a new post',
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

    it('should create a post when online and API request succeeds', (done) => {
      service.createPost(newPostData).subscribe(post => {
        expect(post.id).toBe(3);
        expect(post.title).toBe('New Post');
        expect(post.syncStatus).toBe(SyncStatus.SYNCED);
        done();
      });

      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/posts');
      expect(req.request.method).toBe('POST');
      req.flush(createdPost);
    });

    it('should handle API errors when creating a post', (done) => {
      service.createPost(newPostData).subscribe(post => {
        expect(post.title).toBe('New Post');
        expect(post.syncStatus).toBe(SyncStatus.PENDING);
        done();
      });

      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/posts');
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('updatePost', () => {
    const updateData = {
      title: 'Updated Post'
    };

    it('should update a post locally when offline', (done) => {
      service.updatePost(1, updateData).subscribe(post => {
        expect(post.id).toBe(1);
        expect(post.title).toBe('Updated Post');
        expect(post.syncStatus).toBe(SyncStatus.PENDING);
        done();
      });
    });
  });

  describe('deletePost', () => {
    it('should delete a post when online and API request succeeds', (done) => {
      service.deletePost(1).subscribe(result => {
        expect(result).toBe(true);
        done();
      });

      const req = httpMock.expectOne('https://jsonplaceholder.typicode.com/posts/1');
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });

    it('should throw error when trying to delete non-existent post', (done) => {
      service.deletePost(999).subscribe(
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