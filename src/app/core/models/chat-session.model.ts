export interface ChatSession {
    id: number;
    user_1_id: number;
    user_2_id: number;
    status: 'PENDING' | 'ACTIVE' | 'ENDED' | 'ABANDONED';
    started_at?: string;
    ended_at?: string;
  }
  