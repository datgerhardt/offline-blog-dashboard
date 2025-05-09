import { Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { HomeComponent } from './core/pages/home/home.component';
import { PostComponent } from './core/pages/post/post.component';
import { UsersComponent } from './core/pages/users/users.component';

export const routes: Routes = [
    {
        path: '', component: AppComponent, children: [
            {
              path: 'home', component: HomeComponent,
            },
            {
                path: '', component: HomeComponent,
            },
            {
                path: 'users', component: UsersComponent,
            },
            {
              path: 'posts/:id', component: PostComponent,
            },
            { path: '**',   redirectTo: '', pathMatch: 'full'},
        ]
    }
];
