import { Component } from '@angular/core';
import { BehaviorSubject, Observable, Subject, takeUntil } from 'rxjs';
import { User } from '../../../shared/models/interfaces';
import { Router } from '@angular/router';
import { UserService } from '../../../shared/services/user.service';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../shared/shared.module';
import { MaterialModule } from '../../../../material/material.module';

@Component({
  selector: 'app-users',
  imports: [CommonModule, SharedModule, MaterialModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {

  private unSubscriptioNotifier = new Subject();
  public isLoading = false;

  public usersList = new Array<User>();
  public usersList$: Observable<User[]> = new Observable<User[]>();
  public usersListBehaviour: BehaviorSubject<User[]>;

  constructor(
    private userService: UserService,
    public router: Router
  ){
  this.usersListBehaviour = new BehaviorSubject<User[]>([]);;
  this.usersList$ = this.usersListBehaviour.asObservable();
}


getUsers() {
  this.isLoading = true;
  this.userService.getAllUsers()
    .pipe(takeUntil(this.unSubscriptioNotifier))
    .subscribe({
      next: (actionArray) => {
        this.isLoading = false
        // console.log(actionArray);
        this.usersList = actionArray;
        this.usersListBehaviour.next(actionArray);
      }
    })

}

ngOnInit(): void {
  this.getUsers()
}


ngOnDestroy(): void {
  this.unSubscriptioNotifier.complete()
}
}
