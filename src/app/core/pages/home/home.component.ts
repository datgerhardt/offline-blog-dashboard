import { Component } from '@angular/core';
import { BehaviorSubject, Observable, Subject, takeUntil } from 'rxjs';
import { Post } from '../../../shared/models/interfaces';
import { PostService } from '../../../shared/services/post.service';
import { SharedModule } from '../../../shared/shared.module';
import { MaterialModule } from '../../../../material/material.module';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [MaterialModule, SharedModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  private unSubscriptioNotifier = new Subject();
  public isLoading = false;

  public postList = new Array<Post>();
  public postList$: Observable<Post[]> = new Observable<Post[]>();
  public postListBehaviour: BehaviorSubject<Post[]>;

  constructor(
    private postService: PostService,
    public router: Router
  ){
  this.postListBehaviour = new BehaviorSubject<Post[]>([]);;
  this.postList$ = this.postListBehaviour.asObservable();
}


getPosts() {
  this.isLoading = true;
  this.postService.getAllPosts()
    .pipe(takeUntil(this.unSubscriptioNotifier))
    .subscribe({
      next: (actionArray) => {
        this.isLoading = false
        // console.log(actionArray);
        this.postList = actionArray;
        this.postListBehaviour.next(actionArray);
      }
    })

}
gotoPost(post: Post){
  this.router.navigate([`posts/${post.id}`], { queryParams: {}, skipLocationChange: false });
}

ngOnInit(): void {
  this.getPosts()
}


ngOnDestroy(): void {
  this.unSubscriptioNotifier.complete()
}

}
