export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: number
          match_id: number
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          match_id: number
          message: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          match_id?: number
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      club_aliases: {
        Row: {
          alias: string
          club_id: number
          created_at: string
          id: number
        }
        Insert: {
          alias: string
          club_id: number
          created_at?: string
          id?: never
        }
        Update: {
          alias?: string
          club_id?: number
          created_at?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "club_aliases_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          area_name: string | null
          club_colors: string | null
          created_at: string
          crest_url: string | null
          external_id: number | null
          founded: number | null
          id: number
          name: string
          short_name: string | null
          tla: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          area_name?: string | null
          club_colors?: string | null
          created_at?: string
          crest_url?: string | null
          external_id?: number | null
          founded?: number | null
          id?: never
          name: string
          short_name?: string | null
          tla?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          area_name?: string | null
          club_colors?: string | null
          created_at?: string
          crest_url?: string | null
          external_id?: number | null
          founded?: number | null
          id?: never
          name?: string
          short_name?: string | null
          tla?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string | null
          friend_id: string
          id: number
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          id?: number
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          id?: number
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      live_chat_messages: {
        Row: {
          created_at: string | null
          id: number
          match_id: number
          message: string
          user_id: number
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          match_id: number
          message: string
          user_id: number
          username: string
        }
        Update: {
          created_at?: string | null
          id?: never
          match_id?: number
          message?: string
          user_id?: number
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          api_fixture_id: number | null
          away_club_id: number | null
          away_score: number | null
          away_team_name: string
          external_id: number | null
          home_club_id: number | null
          home_score: number | null
          home_team_name: string
          id: number
          league_code: string | null
          league_name: string
          match_date: string
          matchday: number | null
          season: string | null
          status: string | null
        }
        Insert: {
          api_fixture_id?: number | null
          away_club_id?: number | null
          away_score?: number | null
          away_team_name: string
          external_id?: number | null
          home_club_id?: number | null
          home_score?: number | null
          home_team_name: string
          id?: never
          league_code?: string | null
          league_name: string
          match_date: string
          matchday?: number | null
          season?: string | null
          status?: string | null
        }
        Update: {
          api_fixture_id?: number | null
          away_club_id?: number | null
          away_score?: number | null
          away_team_name?: string
          external_id?: number | null
          home_club_id?: number | null
          home_score?: number | null
          home_team_name?: string
          id?: never
          league_code?: string | null
          league_name?: string
          match_date?: string
          matchday?: number | null
          season?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_club_id_fkey"
            columns: ["away_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_club_id_fkey"
            columns: ["home_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          comment_id: number | null
          created_at: string | null
          from_user_id: string | null
          id: number
          message: string | null
          rating_id: number | null
          read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          comment_id?: number | null
          created_at?: string | null
          from_user_id?: string | null
          id?: number
          message?: string | null
          rating_id?: number | null
          read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          comment_id?: number | null
          created_at?: string | null
          from_user_id?: string | null
          id?: number
          message?: string | null
          rating_id?: number | null
          read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "rating_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          id: number
          is_best_player: boolean
          match_id: number
          player_id: number
          rating: number
          user_id: string
        }
        Insert: {
          id?: number
          is_best_player?: boolean
          match_id: number
          player_id: number
          rating: number
          user_id: string
        }
        Update: {
          id?: number
          is_best_player?: boolean
          match_id?: number
          player_id?: number
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_ratings_parent_rating_fkey"
            columns: ["user_id", "match_id"]
            isOneToOne: false
            referencedRelation: "ratings"
            referencedColumns: ["user_id", "match_id"]
          },
          {
            foreignKeyName: "player_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          club_id: number | null
          created_at: string | null
          id: number
          name: string
          photo_url: string | null
          position: string | null
          shirt_number: number | null
          team: string
        }
        Insert: {
          club_id?: number | null
          created_at?: string | null
          id?: never
          name: string
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          team: string
        }
        Update: {
          club_id?: number | null
          created_at?: string | null
          id?: never
          name?: string
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          away_pred: number
          created_at: string | null
          home_pred: number
          id: number
          match_id: number
          user_id: string
        }
        Insert: {
          away_pred: number
          created_at?: string | null
          home_pred: number
          id?: number
          match_id: number
          user_id: string
        }
        Update: {
          away_pred?: number
          created_at?: string | null
          home_pred?: number
          id?: number
          match_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: number
          rating_id: number
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: number
          rating_id: number
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: number
          rating_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_comments_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_likes: {
        Row: {
          created_at: string | null
          id: number
          rating_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          rating_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          rating_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_likes_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: number
          is_public: boolean
          match_id: number
          match_rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: number
          is_public?: boolean
          match_id: number
          match_rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: number
          is_public?: boolean
          match_id?: number
          match_rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      referee_ratings: {
        Row: {
          created_at: string | null
          id: number
          match_id: number | null
          rating: number | null
          referee_name: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          match_id?: number | null
          rating?: number | null
          referee_name?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: never
          match_id?: number | null
          rating?: number | null
          referee_name?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referee_ratings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string | null
          id: number
          message: string
          status: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          message: string
          status?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: never
          message?: string
          status?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          avg_rating: number | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          favorite_teams: string | null
          id: string
          invite_code: string | null
          is_admin: boolean
          is_public: boolean | null
          last_seen: string | null
          ratings_count: number | null
          streak: number | null
          streak_date: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          avg_rating?: number | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          favorite_teams?: string | null
          id: string
          invite_code?: string | null
          is_admin?: boolean
          is_public?: boolean | null
          last_seen?: string | null
          ratings_count?: number | null
          streak?: number | null
          streak_date?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          avg_rating?: number | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          favorite_teams?: string | null
          id?: string
          invite_code?: string | null
          is_admin?: boolean
          is_public?: boolean | null
          last_seen?: string | null
          ratings_count?: number | null
          streak?: number | null
          streak_date?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_rating_comment: {
        Args: { p_comment: string; p_rating_id: number }
        Returns: Json
      }
      delete_match_rating: {
        Args: { p_match_id: number }
        Returns: {
          avg_rating: number
          deleted: boolean
          ratings_count: number
          streak: number
          streak_date: string
        }[]
      }
      delete_rating_comment: {
        Args: { p_comment_id: number }
        Returns: boolean
      }
      get_club_page: { Args: { p_club_id: number }; Returns: Json }
      get_leaderboard: {
        Args: { p_limit?: number; p_metric?: string }
        Returns: Json
      }
      get_match_insights: { Args: { p_match_id: number }; Returns: Json }
      get_matches_page: {
        Args: {
          p_league?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
        }
        Returns: Json
      }
      get_my_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          avg_rating: number | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          favorite_teams: string | null
          id: string
          invite_code: string | null
          is_admin: boolean
          is_public: boolean | null
          last_seen: string | null
          ratings_count: number | null
          streak: number | null
          streak_date: string | null
          username: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_player_page: { Args: { p_player_id: number }; Returns: Json }
      get_profile_page: {
        Args: { p_rating_limit?: number; p_user_id: string }
        Returns: Json
      }
      get_rating_comments: {
        Args: { p_limit?: number; p_rating_id: number }
        Returns: Json
      }
      get_social_feed: {
        Args: { p_limit?: number; p_offset?: number; p_scope?: string }
        Returns: Json
      }
      get_social_feed_page: {
        Args: {
          p_cursor_created_at?: string
          p_cursor_rating_id?: number
          p_cursor_score?: number
          p_limit?: number
          p_scope?: string
        }
        Returns: Json
      }
      has_accepted_inverse_friendship: {
        Args: { recipient: string; requester: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_user_visible: { Args: { p_user_id: string }; Returns: boolean }
      record_rating_streak: { Args: never; Returns: undefined }
      remove_friendship: { Args: { p_other_id: string }; Returns: Json }
      request_friendship: { Args: { p_friend_id: string }; Returns: Json }
      resolve_invite_code: {
        Args: { lookup_code: string }
        Returns: {
          avatar_url: string
          avg_rating: number
          bio: string
          display_name: string
          favorite_teams: string
          id: string
          is_public: boolean
          ratings_count: number
          streak: number
          username: string
        }[]
      }
      respond_friendship: {
        Args: { p_action: string; p_requester_id: string }
        Returns: Json
      }
      save_match_rating: {
        Args: {
          p_comment?: string
          p_is_public?: boolean
          p_match_id: number
          p_match_rating: number
          p_player_ratings?: Json
        }
        Returns: {
          avg_rating: number
          rating_id: number
          ratings_count: number
          streak: number
          streak_date: string
        }[]
      }
      search_footbazed: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          entity_id: string
          entity_type: string
          meta: string
          relevance: number
          subtitle: string
          title: string
        }[]
      }
      toggle_rating_like: { Args: { p_rating_id: number }; Returns: Json }
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
    Enums: {},
  },
} as const

