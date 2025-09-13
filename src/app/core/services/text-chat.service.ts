import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ChatTextMessage } from '../models/message.model';
import { environment } from '../../shared/components/video-player/environments/environment';

@Injectable({ providedIn: 'root' })
export class TextChatService {
  private base = `${environment.apiBaseUrl}/messages`;
  constructor(private http: HttpClient) {}
  send(msg: ChatTextMessage) { return this.http.post<ChatTextMessage>(`${this.base}/send`, msg); }
  getBySession(sessionId: number) { return this.http.get<ChatTextMessage[]>(`${this.base}/${sessionId}`); }
}
