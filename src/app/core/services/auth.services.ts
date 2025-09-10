import { Injectable } from "@angular/core";
import { environment } from "../../shared/components/video-player/environments/environment";
import { HttpClient } from "@angular/common/http";
import { User } from "../models/user.model";
import { Observable, tap } from "rxjs";
import { LoginResponse } from "../../features/auth/models/auth.model";

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = `${environment.apiBaseUrl}/api/app-users`;
    constructor(private http: HttpClient) { }

    register(userData: Partial<User>): Observable<User> {
        return this.http.post<User>(`${this.apiUrl}/register`, userData);
    }
    login(credentails: { username: string; password: string }): Observable<any> {
        return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentails)
            .pipe(
                tap((res) => {
                    localStorage.setItem('token', res.token);
                    localStorage.setItem('userId', res.userId)
                })
            )
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
    }

    isLoggedIn(): boolean {
        return !!localStorage.getItem('token');
    }
}