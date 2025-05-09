import { Component } from '@angular/core';
import { Post, Comment, SyncStatus } from '../../../shared/models/interfaces';
import { PostService } from '../../../shared/services/post.service';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable, Subject, switchMap, takeUntil } from 'rxjs';
import { CommentService } from '../../../shared/services/comment.service';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-post',
  imports: [CommonModule, SharedModule],
  templateUrl: './post.component.html',
  styleUrl: './post.component.scss'
})
export class PostComponent {

  public postItem: Post = {
    userId: 0,
    title: '',
    body: '',
    syncStatus: SyncStatus.SYNCED,
    updatedAt: 0
  };
  public isLoading = false;
  private postId: number = 0
  private unSubscriptioNotifier = new Subject();

  public commentList = new Array<Comment>();
  public commentList$: Observable<Comment[]> = new Observable<Comment[]>();
  public commentListBehaviour: BehaviorSubject<Comment[]>;


  constructor(
    private router: Router,
    private postService: PostService,
    private commentService: CommentService,
    private _route: ActivatedRoute,
  ) {
    this.commentListBehaviour = new BehaviorSubject<Comment[]>([]);;
    this.commentList$ = this.commentListBehaviour.asObservable();
  }


  ngOnInit() {
    this.isLoading = true;
    let h = this._route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.postId = Number(params.get('id'))
        return combineLatest(
          [
            this.postService.getPost(this.postId),
            this.commentService.getCommentsByPostId(this.postId)
          ]
        ).pipe(takeUntil(this.unSubscriptioNotifier))
      }));
    h.subscribe({
      next: (postAndCommets) => {
        this.isLoading = false
        console.log('posts: ' + JSON.stringify(postAndCommets))
        if (null == postAndCommets[0]) {
          this.router.navigate(['home'], { queryParams: { tab: 1 }, skipLocationChange: false });
        } else {
          this.postItem = postAndCommets[0];
          this.commentList = postAndCommets[1];
          this.commentListBehaviour.next(postAndCommets[1]);

        }

      }, error: (error) => {
        this.isLoading = false
      }
    })
  }


}
