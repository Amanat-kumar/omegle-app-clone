import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { HomeComponent } from './features/home/home.component';
import { AuthGuard } from './core/guards/auth.guard';
import { VideoChatComponent } from './features/chat/video-chat/video-chat.component';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    {
        path: 'home', component: HomeComponent, canActivate:[AuthGuard]
    },
    {
        path: 'video-chat', component: VideoChatComponent
    },
    { path: '**', redirectTo: 'login' }
];
