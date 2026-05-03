export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_escalations: {
        Row: {
          admin_id: string | null
          admin_reply: string | null
          ai_suggestion: string | null
          ai_summary: string | null
          conversation_id: string | null
          created_at: string
          id: string
          reason: string
          resolved_at: string | null
          status: string
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          admin_reply?: string | null
          ai_suggestion?: string | null
          ai_summary?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          reason: string
          resolved_at?: string | null
          status?: string
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string | null
          admin_reply?: string | null
          ai_suggestion?: string | null
          ai_summary?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_escalations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_escalations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      bet_selections: {
        Row: {
          bet_id: string
          created_at: string
          id: string
          market: string
          match_id: string
          odds_value: number
          selection: string
          status: Database["public"]["Enums"]["bet_status"]
        }
        Insert: {
          bet_id: string
          created_at?: string
          id?: string
          market: string
          match_id: string
          odds_value: number
          selection: string
          status?: Database["public"]["Enums"]["bet_status"]
        }
        Update: {
          bet_id?: string
          created_at?: string
          id?: string
          market?: string
          match_id?: string
          odds_value?: number
          selection?: string
          status?: Database["public"]["Enums"]["bet_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bet_selections_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_selections_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          booking_code: string | null
          cashout_amount: number | null
          created_at: string
          id: string
          payout: number | null
          potential_payout: number
          settled_at: string | null
          stake: number
          status: Database["public"]["Enums"]["bet_status"]
          total_odds: number
          user_id: string
        }
        Insert: {
          booking_code?: string | null
          cashout_amount?: number | null
          created_at?: string
          id?: string
          payout?: number | null
          potential_payout: number
          settled_at?: string | null
          stake: number
          status?: Database["public"]["Enums"]["bet_status"]
          total_odds: number
          user_id: string
        }
        Update: {
          booking_code?: string | null
          cashout_amount?: number | null
          created_at?: string
          id?: string
          payout?: number | null
          potential_payout?: number
          settled_at?: string | null
          stake?: number
          status?: Database["public"]["Enums"]["bet_status"]
          total_odds?: number
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      chat_channels: {
        Row: {
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["chat_channel_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["chat_channel_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["chat_channel_type"]
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          channel_id: string
          content: string | null
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      live_score_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          match_id: string
          minute: number | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          match_id: string
          minute?: number | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          match_id?: string
          minute?: number | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_score_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_score_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_categories: {
        Row: {
          category_id: string
          match_id: string
        }
        Insert: {
          category_id: string
          match_id: string
        }
        Update: {
          category_id?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_categories_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number
          away_team_id: string
          created_at: string
          ended_at: string | null
          home_score: number
          home_team_id: string
          id: string
          kickoff_time: string
          league: string | null
          match_minute: number | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          winner: string | null
        }
        Insert: {
          away_score?: number
          away_team_id: string
          created_at?: string
          ended_at?: string | null
          home_score?: number
          home_team_id: string
          id?: string
          kickoff_time: string
          league?: string | null
          match_minute?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          winner?: string | null
        }
        Update: {
          away_score?: number
          away_team_id?: string
          created_at?: string
          ended_at?: string | null
          home_score?: number
          home_team_id?: string
          id?: string
          kickoff_time?: string
          league?: string | null
          match_minute?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      odds: {
        Row: {
          id: string
          is_active: boolean
          market: string
          match_id: string
          selection: string
          updated_at: string
          value: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          market: string
          match_id: string
          selection: string
          updated_at?: string
          value: number
        }
        Update: {
          id?: string
          is_active?: boolean
          market?: string
          match_id?: string
          selection?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "odds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          jersey_number: number | null
          match_id: string
          name: string
          position: string | null
          squad_type: Database["public"]["Enums"]["squad_type"]
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          jersey_number?: number | null
          match_id: string
          name: string
          position?: string | null
          squad_type?: Database["public"]["Enums"]["squad_type"]
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          jersey_number?: number | null
          match_id?: string
          name?: string
          position?: string | null
          squad_type?: Database["public"]["Enums"]["squad_type"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          discord_username: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          server: string
          token_balance: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discord_username?: string | null
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          server?: string
          token_balance?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discord_username?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          server?: string
          token_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          country: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          short_name: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          short_name?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          ticket_id: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      token_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          image_url: string | null
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["token_request_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          image_url?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["token_request_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          image_url?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["token_request_status"]
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          note: string | null
          reference_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          note?: string | null
          reference_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          note?: string | null
          reference_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_token_request: {
        Args: { _admin_note?: string; _req_id: string }
        Returns: undefined
      }
      cashout_bet: {
        Args: { _bet_id: string; _fraction?: number }
        Returns: number
      }
      deny_token_request: {
        Args: { _admin_note?: string; _req_id: string }
        Returns: undefined
      }
      edit_bet: {
        Args: {
          _add_selections: Json
          _bet_id: string
          _new_stake: number
          _remove_selection_ids: string[]
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_mod_or_admin: { Args: { _user_id: string }; Returns: boolean }
      place_bet: {
        Args: { _selections: Json; _stake: number }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "gang_leader"
        | "shooter"
        | "registered"
        | "viewer"
      bet_status: "open" | "won" | "lost" | "cashed_out" | "void"
      chat_channel_type: "general" | "gang" | "moderator"
      match_status: "upcoming" | "live" | "ended" | "cancelled"
      squad_type: "main" | "sub"
      ticket_status: "open" | "closed" | "reported"
      token_request_status: "pending" | "approved" | "denied"
      transaction_type:
        | "grant"
        | "request_approved"
        | "bet_placed"
        | "bet_won"
        | "bet_refund"
        | "cashout"
        | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "gang_leader",
        "shooter",
        "registered",
        "viewer",
      ],
      bet_status: ["open", "won", "lost", "cashed_out", "void"],
      chat_channel_type: ["general", "gang", "moderator"],
      match_status: ["upcoming", "live", "ended", "cancelled"],
      squad_type: ["main", "sub"],
      ticket_status: ["open", "closed", "reported"],
      token_request_status: ["pending", "approved", "denied"],
      transaction_type: [
        "grant",
        "request_approved",
        "bet_placed",
        "bet_won",
        "bet_refund",
        "cashout",
        "adjustment",
      ],
    },
  },
} as const
