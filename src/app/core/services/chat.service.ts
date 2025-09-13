import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ChatSession } from '../models/chat-session.model';
import { environment } from '../../shared/components/video-player/environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private base = `${environment.apiBaseUrl}/api/chats`;

  constructor(private http: HttpClient) {}

  startRandom() { return this.http.post<ChatSession>(`${this.base}/start`, {}); }
  getActive() { return this.http.get<ChatSession[]>(`${this.base}/active`); }
  getById(id: number) { return this.http.get<ChatSession>(`${this.base}/${id}`); }
}
