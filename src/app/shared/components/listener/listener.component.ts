import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-listener',
  imports: [],
  templateUrl: './listener.component.html',
  styleUrl: './listener.component.scss'
})
export class ListenerComponent {

  isOnline: boolean = navigator.onLine;

  @HostListener('window:online', [])
  onOnline() {
    this.isOnline = true;
    console.log('User is online');
  }

  @HostListener('window:offline', [])
  onOffline() {
    this.isOnline = false;
    console.log('User is offline');
  }
}

