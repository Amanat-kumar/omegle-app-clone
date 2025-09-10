import { Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../../core/services/auth.services";
import { Router, RouterLink } from "@angular/router";
import { CommonModule } from "@angular/common";


@Component({
    selector: 'app-login',
    standalone: true,
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    imports: [CommonModule, ReactiveFormsModule, RouterLink]
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    errorMessage = '';

    form = this.fb.group({
        username: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(8)]]
    });

    onSubmit() {
        console.log("onSubmit login");
        
        if (this.form.invalid) return;
        const credentials = this.form.getRawValue() as { username: string; password: string };
        this.authService.login(credentials).subscribe({
            next: () => this.router.navigate(['/home']),
            error: (err) => {
                this.errorMessage = err.error?.message || 'Invalid credntials';
            }
        });
    }
}