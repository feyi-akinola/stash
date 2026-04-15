export type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  room_id: string;
  message_type: 1 | 2;
  role: 1 | 2;
}

export type TempMessage = Message & {
  tempId?: string;
  sending?: boolean;
};

export type Room = {
  id: string;
  name: string;
  created_at: string;
  creator_id: string;
  is_private: string;
}

export type Participant = {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  room_id: string;
}

export type Session = {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null | undefined | undefined;
    userAgent?: string | null | undefined | undefined;
  };
  user: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null | undefined | undefined;
  }
};