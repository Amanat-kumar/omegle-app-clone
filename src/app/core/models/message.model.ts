export interface ChatTextMessage {
    id?: number;
    chat_session_id: number;
    sender_id: number;
    message: string;
    sent_at?: string;
  }
  