import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { NgModule } from "@angular/core";
import { authInterceptor } from "./interceptors/auth.interceptor";

@NgModule({
    providers: [
        {
            provide: HTTP_INTERCEPTORS,
            useValue: authInterceptor,
            multi: true
        }
    ]
})
export class CoreModule { }