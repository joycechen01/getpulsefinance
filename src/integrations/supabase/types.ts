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
      companies: {
        Row: {
          cik: number
          description: string | null
          exchanges: string[] | null
          facts_fetched_at: string | null
          fiscal_year_end: string | null
          name: string
          sic_description: string | null
          submissions_fetched_at: string | null
          ticker: string
        }
        Insert: {
          cik: number
          description?: string | null
          exchanges?: string[] | null
          facts_fetched_at?: string | null
          fiscal_year_end?: string | null
          name: string
          sic_description?: string | null
          submissions_fetched_at?: string | null
          ticker: string
        }
        Update: {
          cik?: number
          description?: string | null
          exchanges?: string[] | null
          facts_fetched_at?: string | null
          fiscal_year_end?: string | null
          name?: string
          sic_description?: string | null
          submissions_fetched_at?: string | null
          ticker?: string
        }
        Relationships: []
      }
      digest_deliveries: {
        Row: {
          accession: string
          created_at: string
          error: string | null
          gmail_id: string | null
          id: string
          period_end: string
          recipient: string
          sent_at: string | null
          status: string
          ticker: string
          user_id: string
        }
        Insert: {
          accession: string
          created_at?: string
          error?: string | null
          gmail_id?: string | null
          id?: string
          period_end: string
          recipient: string
          sent_at?: string | null
          status: string
          ticker: string
          user_id: string
        }
        Update: {
          accession?: string
          created_at?: string
          error?: string | null
          gmail_id?: string | null
          id?: string
          period_end?: string
          recipient?: string
          sent_at?: string | null
          status?: string
          ticker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      filing_extractions: {
        Row: {
          accession: string
          cik: number
          extracted_at: string
          section_counts: Json
          status: string
        }
        Insert: {
          accession: string
          cik: number
          extracted_at?: string
          section_counts?: Json
          status: string
        }
        Update: {
          accession?: string
          cik?: number
          extracted_at?: string
          section_counts?: Json
          status?: string
        }
        Relationships: []
      }
      filing_passages: {
        Row: {
          accession: string
          body: string
          cik: number
          id: number
          pos: number
          section: string
          tsv: unknown
        }
        Insert: {
          accession: string
          body: string
          cik: number
          id?: number
          pos: number
          section: string
          tsv?: unknown
        }
        Update: {
          accession?: string
          body?: string
          cik?: number
          id?: number
          pos?: number
          section?: string
          tsv?: unknown
        }
        Relationships: []
      }
      filing_research: {
        Row: {
          accession: string
          cik: number
          created_at: string
          data: Json
        }
        Insert: {
          accession: string
          cik: number
          created_at?: string
          data: Json
        }
        Update: {
          accession?: string
          cik?: number
          created_at?: string
          data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "filing_research_accession_fkey"
            columns: ["accession"]
            isOneToOne: true
            referencedRelation: "filings"
            referencedColumns: ["accession"]
          },
        ]
      }
      filings: {
        Row: {
          accession: string
          cik: number
          description: string | null
          filing_date: string
          form: string
          items: string | null
          primary_document: string | null
          report_date: string | null
        }
        Insert: {
          accession: string
          cik: number
          description?: string | null
          filing_date: string
          form: string
          items?: string | null
          primary_document?: string | null
          report_date?: string | null
        }
        Update: {
          accession?: string
          cik?: number
          description?: string | null
          filing_date?: string
          form?: string
          items?: string | null
          primary_document?: string | null
          report_date?: string | null
        }
        Relationships: []
      }
      financial_facts: {
        Row: {
          cik: number
          currency: string
          data: Json
          fetched_at: string
          fiscal_year_end_month: number
        }
        Insert: {
          cik: number
          currency: string
          data: Json
          fetched_at?: string
          fiscal_year_end_month: number
        }
        Update: {
          cik?: number
          currency?: string
          data?: Json
          fetched_at?: string
          fiscal_year_end_month?: number
        }
        Relationships: []
      }
      holdings: {
        Row: {
          avg_price: number | null
          cik: number
          company_name: string
          created_at: string
          id: string
          shares: number | null
          ticker: string
          user_id: string
        }
        Insert: {
          avg_price?: number | null
          cik: number
          company_name: string
          created_at?: string
          id?: string
          shares?: number | null
          ticker: string
          user_id: string
        }
        Update: {
          avg_price?: number | null
          cik?: number
          company_name?: string
          created_at?: string
          id?: string
          shares?: number | null
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          audio_digest_enabled: boolean
          created_at: string
          delivery_email: string | null
          digest_email_enabled: boolean
          id: string
          onboarded: boolean
          updated_at: string
        }
        Insert: {
          audio_digest_enabled?: boolean
          created_at?: string
          delivery_email?: string | null
          digest_email_enabled?: boolean
          id: string
          onboarded?: boolean
          updated_at?: string
        }
        Update: {
          audio_digest_enabled?: boolean
          created_at?: string
          delivery_email?: string | null
          digest_email_enabled?: boolean
          id?: string
          onboarded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      redlines: {
        Row: {
          accession: string
          changes: Json
          cik: number
          created_at: string
          prior_accession: string
        }
        Insert: {
          accession: string
          changes: Json
          cik: number
          created_at?: string
          prior_accession: string
        }
        Update: {
          accession?: string
          changes?: Json
          cik?: number
          created_at?: string
          prior_accession?: string
        }
        Relationships: []
      }
      signal_analyses: {
        Row: {
          accession: string
          analyzed_at: string
          cik: number
          signal_count: number
        }
        Insert: {
          accession: string
          analyzed_at?: string
          cik: number
          signal_count?: number
        }
        Update: {
          accession?: string
          analyzed_at?: string
          cik?: number
          signal_count?: number
        }
        Relationships: []
      }
      signals: {
        Row: {
          accession: string
          category: string
          cik: number
          confidence: string
          created_at: string
          filed_date: string | null
          history: string
          id: string
          metric_note: string | null
          passage_ids: number[]
          title: string
          uncertain: string
          what_happened: string
          whats_new: string
          why_it_matters: string
        }
        Insert: {
          accession: string
          category: string
          cik: number
          confidence: string
          created_at?: string
          filed_date?: string | null
          history: string
          id?: string
          metric_note?: string | null
          passage_ids?: number[]
          title: string
          uncertain: string
          what_happened: string
          whats_new: string
          why_it_matters: string
        }
        Update: {
          accession?: string
          category?: string
          cik?: number
          confidence?: string
          created_at?: string
          filed_date?: string | null
          history?: string
          id?: string
          metric_note?: string | null
          passage_ids?: number[]
          title?: string
          uncertain?: string
          what_happened?: string
          whats_new?: string
          why_it_matters?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_passages: {
        Args: { _cik: number; _limit?: number; _q: string }
        Returns: {
          accession: string
          body: string
          id: number
          pos: number
          rank: number
          section: string
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
