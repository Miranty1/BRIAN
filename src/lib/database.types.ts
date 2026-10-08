// Hand-written to match supabase/migrations. Regenerate with `npm run db:types`.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      content_items: {
        Row: {
          id: string
          game_id: string
          band: number
          payload: Json
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          band: number
          payload: Json
          source: string
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          band?: number
          payload?: Json
          source?: string
          created_at?: string
        }
        Relationships: []
      }
      game_progress: {
        Row: {
          user_id: string
          game_id: string
          level: number
          best_score: number | null
          rounds_played: number
          last_played_at: string | null
        }
        Insert: {
          user_id?: string
          game_id: string
          level?: number
          best_score?: number | null
          rounds_played?: number
          last_played_at?: string | null
        }
        Update: {
          user_id?: string
          game_id?: string
          level?: number
          best_score?: number | null
          rounds_played?: number
          last_played_at?: string | null
        }
        Relationships: []
      }
      item_seen: {
        Row: {
          user_id: string
          item_id: string
          seen_at: string
        }
        Insert: {
          user_id?: string
          item_id: string
          seen_at?: string
        }
        Update: {
          user_id?: string
          item_id?: string
          seen_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          id: string
          user_id: string
          game_id: string
          level: number
          score: number
          accuracy: number
          avg_response_ms: number | null
          workout_id: string | null
          played_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          game_id: string
          level: number
          score: number
          accuracy: number
          avg_response_ms?: number | null
          workout_id?: string | null
          played_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          game_id?: string
          level?: number
          score?: number
          accuracy?: number
          avg_response_ms?: number | null
          workout_id?: string | null
          played_at?: string
        }
        Relationships: []
      }
      skill_snapshots: {
        Row: {
          user_id: string
          track: string
          local_date: string
          score: number
        }
        Insert: {
          user_id?: string
          track: string
          local_date: string
          score: number
        }
        Update: {
          user_id?: string
          track?: string
          local_date?: string
          score?: number
        }
        Relationships: []
      }
      streak_freezes: {
        Row: {
          id: string
          user_id: string
          earned_at: string
          used_on: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          earned_at?: string
          used_on?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          earned_at?: string
          used_on?: string | null
        }
        Relationships: []
      }
      vocab_cards: {
        Row: {
          user_id: string
          item_id: string
          interval_days: number
          due_on: string
          reps: number
          lapses: number
          status: string
          last_reviewed_at: string | null
        }
        Insert: {
          user_id?: string
          item_id: string
          interval_days?: number
          due_on?: string
          reps?: number
          lapses?: number
          status?: string
          last_reviewed_at?: string | null
        }
        Update: {
          user_id?: string
          item_id?: string
          interval_days?: number
          due_on?: string
          reps?: number
          lapses?: number
          status?: string
          last_reviewed_at?: string | null
        }
        Relationships: []
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          local_date: string
          game_ids: string[]
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          local_date: string
          game_ids: string[]
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          local_date?: string
          game_ids?: string[]
          completed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
