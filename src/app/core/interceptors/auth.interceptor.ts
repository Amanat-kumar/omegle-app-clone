import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, Observable, throwError } from "rxjs";

export const authInterceptor: HttpInterceptorFn = (
    req: HttpRequest<any>,
    next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
    console.log("interceptor:::::::::::");
    
    const router = inject(Router);
    const token = localStorage.getItem('token');

    if (req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
        return next(req);
    }
    const authReq = token ? req.clone({
        setHeaders: {
            Authorization: `Bearer ${token}`
        }
    }) : req;

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                router.navigate(['/login']);
            }
            return throwError(() => error);
        })
    );
};