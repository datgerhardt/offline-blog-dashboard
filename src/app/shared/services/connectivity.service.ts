
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, from, interval, map, Observable, of, startWith, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConnectivityService {

  // Window Listener for some reason is not working and navigator.onLine is also throw alot undefined
  //  TODO: rewrite

  // Test only 
  // private url = 'https://www.google.com/generate_204';
  // internetStatus$ = interval(60000 * 5).pipe( 
  //     startWith(0), 
  //     switchMap(() =>
  //       from(fetch(this.url, { method: 'GET', mode: 'no-cors' })).pipe(
  //         map(() => true),
  //         catchError(() => of(false))
  //       )
  //     )
  //   );

  constructor() {} 
}