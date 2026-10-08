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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      content_items: {
        Row: {
          band: number
          created_at: string
          game_id: string
          id: string
          payload: Json
          source: string
        }
        Insert: {
          band: number
          created_at?: string
          game_id: string
          id?: string
          payload: Json
          source: string
        }
        Update: {
          band?: number
          created_at?: string
          game_id?: string
          id?: string
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      game_progress: {
        Row: {
          best_score: number | null
          game_id: string
          last_played_at: string | null
          level: number
          rounds_played: number
          user_id: string
        }
        Insert: {
          best_score?: number | null
          game_id: string
          last_played_at?: string | null
          level?: number
          rounds_played?: number
          user_id?: string
        }
        Update: {
          best_score?: number | null
          game_id?: string
          last_played_at?: string | null
          level?: number
          rounds_played?: number
          user_id?: string
        }
        Relationships: []
      }
      item_seen: {
        Row: {
          item_id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          item_id: string
          seen_at?: string
          user_id?: string
        }
        Update: {
          item_id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_seen_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          accuracy: number
          avg_response_ms: number | null
          game_id: string
          id: string
          level: number
          played_at: string
          score: number
          user_id: string
          workout_id: string | null
        }
        Insert: {
          accuracy: number
          avg_response_ms?: number | null
          game_id: string
          id?: string
          level: number
          played_at?: string
          score: number
          user_id?: string
          workout_id?: string | null
        }
        Update: {
          accuracy?: number
          avg_response_ms?: number | null
          game_id?: string
          id?: string
          level?: number
          played_at?: string
          score?: number
          user_id?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_snapshots: {
        Row: {
          local_date: string
          score: number
          track: string
          user_id: string
        }
        Insert: {
          local_date: string
          score: number
          track: string
          user_id?: string
        }
        Update: {
          local_date?: string
          score?: number
          track?: string
          user_id?: string
        }
        Relationships: []
      }
      streak_freezes: {
        Row: {
          earned_at: string
          id: string
          used_on: string | null
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          used_on?: string | null
          user_id?: string
        }
        Update: {
          earned_at?: string
          id?: string
          used_on?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vocab_cards: {
        Row: {
          due_on: string
          interval_days: number
          item_id: string
          lapses: number
          last_reviewed_at: string | null
          reps: number
          status: string
          user_id: string
        }
        Insert: {
          due_on?: string
          interval_days?: number
          item_id: string
          lapses?: number
          last_reviewed_at?: string | null
          reps?: number
          status?: string
          user_id?: string
        }
        Update: {
          due_on?: string
          interval_days?: number
          item_id?: string
          lapses?: number
          last_reviewed_at?: string | null
          reps?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocab_cards_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          completed_at: string | null
          game_ids: string[]
          id: string
          local_date: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          game_ids: string[]
          id?: string
          local_date: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          game_ids?: string[]
          id?: string
          local_date?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
