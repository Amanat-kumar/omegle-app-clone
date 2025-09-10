import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../../../core/services/auth.services";
import { Router, RouterLink } from "@angular/router";

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {

    registerForm!: FormGroup;
    errorMessage = '';

    constructor(
        private fb: FormBuilder,
        private authServces: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.registerForm = this.fb.group({
            username: ['', [Validators.required, Validators.minLength(3)]],
            email: ['', Validators.required, Validators.email],
            password: [Validators.required, Validators.minLength(8)]
        })
    }

    onSubmit() {
        if (this.registerForm.valid) {
            this.authServces.register(this.registerForm.value).subscribe({
                next: () => this.router.navigate(['/login']),
                error: (err) => this.errorMessage = err.error?.message || 'Registeration failed'
            })
        }
    }
}