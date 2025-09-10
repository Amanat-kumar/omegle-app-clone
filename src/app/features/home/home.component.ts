import { Component, inject, OnInit } from "@angular/core";
import { AuthService } from "../../core/services/auth.services";
import { Router } from "@angular/router";

@Component({
    selector: 'app-home',
    standalone: true,
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

    private authService = inject(AuthService);
    private router = inject(Router);

    username: string | null = null;

    ngOnInit(): void {
        this.username = localStorage.getItem('userId');
    }
    startVideoChat() {
        this.router.navigate(['/video-chat'])
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}