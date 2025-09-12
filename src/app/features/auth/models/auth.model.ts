export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    issueAt: Date
    expiresIn: Date;
    userId: string;

}