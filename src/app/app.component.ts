import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CoreModule } from './core/core.module';
import { ConnectivityService } from './shared/services/connectivity.service';
import { SyncService } from './shared/services/sync.service';
import { DatabaseService } from './shared/services/database.service';
import { Post, SyncStatus, Comment } from './shared/models/interfaces';
import { MaterialModule } from '../material/material.module';
import { SharedModule } from './shared/shared.module';
import { BehaviorSubject, catchError, from, interval, map, Observable, of, startWith, Subject, switchMap, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CoreModule, MaterialModule, SharedModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'offline-blog-dashboard';

  isOnline = navigator.onLine;
  isSyncing = false;
  pendingSyncCount= 0

  private unSubscriptioNotifier = new Subject();

  constructor(
    // private connectivityService: ConnectivityService,
    private syncService: SyncService,
  ) {
    
  }

  ngOnInit(): void {

    // this.connectivityService.internetStatus$.subscribe(status => {
    //   this.isOnline = status;
    //   if (status) {
    //     this.syncService.initialSync();
    //     this.syncService.syncPendingOperations();
    //   }
    // });
  }
  

  ngOnDestroy(): void {
    // this.unSubscriptioNotifier.next()
    this.unSubscriptioNotifier.complete()
  }
}
