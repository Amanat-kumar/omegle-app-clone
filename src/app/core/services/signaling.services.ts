import { Injectable } from '@angular/core';
import { Client, Message, over } from 'stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class SignalingService {
    private stompClient!: Client;
    private connected = false;

    // stream of messages for ChatService
    private messagesSubject = new BehaviorSubject<any>(null);
    public messages$ = this.messagesSubject.asObservable();

    private serverUrl = 'http://localhost:8080/ws'; // backend signaling endpoint

    connect(userId: string): void {
        if (this.connected) {
            return;
        }

        const socket = new SockJS(this.serverUrl);
        this.stompClient = over(socket);

        this.stompClient.connect({}, () => {
            this.connected = true;

            // subscribe to personal queue
            this.stompClient.subscribe(`/queue/${userId}`, (message: Message) => {
                if (message.body) {
                    this.messagesSubject.next(JSON.parse(message.body));
                }
            });

            // (optional) subscribe to a topic for broadcast/matchmaking
            this.stompClient.subscribe(`/topic/signaling`, (message: Message) => {
                if (message.body) {
                    this.messagesSubject.next(JSON.parse(message.body));
                }
            });
        });
    }

    sendMessage(payload: any): void {
        if (this.stompClient && this.connected) {
            this.stompClient.send('/app/signaling', {}, JSON.stringify(payload));
        }
    }

    disconnect(): void {
        if (this.stompClient) {
            this.stompClient.disconnect(() => {
                this.connected = false;
            });
        }
    }
}
