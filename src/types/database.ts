export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "USER" | "ADMIN";
export type MessageType = "TEXT" | "IMAGE" | "SYSTEM";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          role: UserRole;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          role?: UserRole;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          role?: UserRole;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: number;
          author_id: string | null;
          title: string;
          content: string;
          image_urls: string[];
          view_count: number;
          like_count: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          author_id?: string | null;
          title: string;
          content: string;
          image_urls?: string[];
          view_count?: number;
          like_count?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          author_id?: string | null;
          title?: string;
          content?: string;
          image_urls?: string[];
          view_count?: number;
          like_count?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      post_views: {
        Row: {
          id: number;
          post_id: number;
          user_id: string | null;
          ip_hash: string;
          viewed_date: string;
        };
        Insert: {
          id?: number;
          post_id: number;
          user_id?: string | null;
          ip_hash: string;
          viewed_date?: string;
        };
        Update: {
          id?: number;
          post_id?: number;
          user_id?: string | null;
          ip_hash?: string;
          viewed_date?: string;
        };
      };
      comments: {
        Row: {
          id: number;
          post_id: number;
          author_id: string | null;
          content: string;
          image_url?: string | null;
          like_count?: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          post_id: number;
          author_id?: string | null;
          content: string;
          image_url?: string | null;
          like_count?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          post_id?: number;
          author_id?: string | null;
          content?: string;
          image_url?: string | null;
          like_count?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      chat_rooms: {
        Row: {
          id: string;
          name: string | null;
          avatar_url: string | null;
          is_group: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          avatar_url?: string | null;
          is_group?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          avatar_url?: string | null;
          is_group?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
      };
      chat_participants: {
        Row: {
          room_id: string;
          user_id: string;
          joined_at: string;
          last_read_at: string;
          left_at: string | null;
        };
        Insert: {
          room_id: string;
          user_id: string;
          joined_at?: string;
          last_read_at?: string;
          left_at?: string | null;
        };
        Update: {
          room_id?: string;
          user_id?: string;
          joined_at?: string;
          last_read_at?: string;
          left_at?: string | null;
        };
      };
      messages: {
        Row: {
          id: number;
          room_id: string;
          sender_id: string | null;
          content: string | null;
          image_url: string | null;
          message_type: MessageType;
          created_at: string;
        };
        Insert: {
          id?: number;
          room_id: string;
          sender_id?: string | null;
          content?: string | null;
          image_url?: string | null;
          message_type?: MessageType;
          created_at?: string;
        };
        Update: {
          id?: number;
          room_id?: string;
          sender_id?: string | null;
          content?: string | null;
          image_url?: string | null;
          message_type?: MessageType;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          ip_address: string | null;
          user_agent: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id: string;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
    };
    Functions: {
      increment_post_view: {
        Args: {
          p_post_id: number;
          p_user_id: string | null;
          p_ip_hash: string;
        };
        Returns: boolean;
      };
      is_admin: {
        Args: {
          p_user_id?: string;
        };
        Returns: boolean;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"] & {
  author?: Profile | null;
  comments_count?: number;
  formatted_date?: string;
};
export type Comment = Database["public"]["Tables"]["comments"]["Row"] & {
  author?: Profile | null;
};
export type ChatRoom = Database["public"]["Tables"]["chat_rooms"]["Row"] & {
  participants?: (Database["public"]["Tables"]["chat_participants"]["Row"] & {
    profile?: Profile | null;
  })[];
  last_message?: Database["public"]["Tables"]["messages"]["Row"] | null;
  unread_count?: number;
};
export type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  sender?: Profile | null;
};
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"] & {
  actor?: Profile | null;
};
