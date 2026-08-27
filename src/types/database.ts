// 이 파일은 Supabase 스키마에서 생성된 타입입니다. 직접 수정하지 마세요.
// 스키마 변경 후 재생성: Supabase MCP generate_typescript_types 또는
//   supabase gen types typescript --project-id ikusdwursvbdrznbcjtw > src/types/database.ts

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
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      life_info: {
        Row: {
          address: string | null
          category: string
          id: string
          is_published: boolean
          language_support: string | null
          latitude: number | null
          localized_content: Json
          longitude: number | null
          opening_hours: string | null
          phone: string | null
          region_id: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          address?: string | null
          category: string
          id?: string
          is_published?: boolean
          language_support?: string | null
          latitude?: number | null
          localized_content: Json
          longitude?: number | null
          opening_hours?: string | null
          phone?: string | null
          region_id: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          id?: string
          is_published?: boolean
          language_support?: string | null
          latitude?: number | null
          localized_content?: Json
          longitude?: number | null
          opening_hours?: string | null
          phone?: string | null
          region_id?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "life_info_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          category: string
          created_at: string
          embedding: string | null
          id: string
          region_id: string
          source_locale: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          category: string
          created_at?: string
          embedding?: string | null
          id?: string
          region_id: string
          source_locale: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          category?: string
          created_at?: string
          embedding?: string | null
          id?: string
          region_id?: string
          source_locale?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string | null
          country_code: string | null
          created_at: string
          crop_type: string | null
          id: string
          is_matching_visible: boolean
          nickname: string
          preferred_locale: string
          region_id: string | null
          role: string
        }
        Insert: {
          auth_provider?: string | null
          country_code?: string | null
          created_at?: string
          crop_type?: string | null
          id: string
          is_matching_visible?: boolean
          nickname: string
          preferred_locale: string
          region_id?: string | null
          role?: string
        }
        Update: {
          auth_provider?: string | null
          country_code?: string | null
          created_at?: string
          crop_type?: string | null
          id?: string
          is_matching_visible?: boolean
          nickname?: string
          preferred_locale?: string
          region_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          centroid_lat: number | null
          centroid_lng: number | null
          id: string
          is_active: boolean
          level: string
          names: Json
          parent_id: string | null
        }
        Insert: {
          centroid_lat?: number | null
          centroid_lng?: number | null
          id?: string
          is_active?: boolean
          level: string
          names: Json
          parent_id?: string | null
        }
        Update: {
          centroid_lat?: number | null
          centroid_lng?: number | null
          id?: string
          is_active?: boolean
          level?: string
          names?: Json
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      neighbor_profiles: {
        Row: {
          country_code: string | null
          crop_type: string | null
          id: string | null
          nickname: string | null
          preferred_locale: string | null
          region_id: string | null
        }
        Insert: {
          country_code?: string | null
          crop_type?: string | null
          id?: string | null
          nickname?: string | null
          preferred_locale?: string | null
          region_id?: string | null
        }
        Update: {
          country_code?: string | null
          crop_type?: string | null
          id?: string | null
          nickname?: string | null
          preferred_locale?: string | null
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          country_code: string | null
          id: string | null
          nickname: string | null
        }
        Insert: {
          country_code?: never
          id?: string | null
          nickname?: string | null
        }
        Update: {
          country_code?: never
          id?: string | null
          nickname?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_matching_opted_in: { Args: never; Returns: boolean }
      similar_posts: {
        Args: { source_id: string; match_count?: number }
        Returns: {
          id: string
          title: string
          category: string
          region_id: string
          created_at: string
          similarity: number
        }[]
      }
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
