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
  app_social: {
    Tables: {
      analytics_snapshots: {
        Row: {
          avg_comments: number | null
          avg_likes: number | null
          avg_views: number | null
          created_at: string
          display_name: string | null
          engagement_rate: number | null
          fetched_at: string
          followers: number | null
          following: number | null
          id: string
          org_id: string
          platform: string
          posts_count: number | null
          profile_image_url: string | null
          raw_data: Json | null
          recent_posts: Json | null
          user_id: string | null
          username: string
        }
        Insert: {
          avg_comments?: number | null
          avg_likes?: number | null
          avg_views?: number | null
          created_at?: string
          display_name?: string | null
          engagement_rate?: number | null
          fetched_at?: string
          followers?: number | null
          following?: number | null
          id?: string
          org_id: string
          platform: string
          posts_count?: number | null
          profile_image_url?: string | null
          raw_data?: Json | null
          recent_posts?: Json | null
          user_id?: string | null
          username: string
        }
        Update: {
          avg_comments?: number | null
          avg_likes?: number | null
          avg_views?: number | null
          created_at?: string
          display_name?: string | null
          engagement_rate?: number | null
          fetched_at?: string
          followers?: number | null
          following?: number | null
          id?: string
          org_id?: string
          platform?: string
          posts_count?: number | null
          profile_image_url?: string | null
          raw_data?: Json | null
          recent_posts?: Json | null
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      autopilot_calendars: {
        Row: {
          config_id: string
          created_at: string
          cycle_end: string
          cycle_start: string
          id: string
          org_id: string
          research_results: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config_id: string
          created_at?: string
          cycle_end: string
          cycle_start: string
          id?: string
          org_id: string
          research_results?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config_id?: string
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          id?: string
          org_id?: string
          research_results?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_calendars_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "autopilot_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_configs: {
        Row: {
          brand_id: string | null
          content_types: string[] | null
          created_at: string
          id: string
          image_provider: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          org_id: string
          platforms: string[]
          posts_per_cycle: number
          preferred_days: number[] | null
          preferred_times: string[] | null
          recurrence: string
          reference_accounts: string[]
          requires_approval: boolean
          research_topics: string[]
          research_urls: string[] | null
          social_account_ids: string[]
          themes: Json
          timezone: string
          tone: string | null
          updated_at: string
          user_id: string
          video_model: string | null
          visual_format: string
        }
        Insert: {
          brand_id?: string | null
          content_types?: string[] | null
          created_at?: string
          id?: string
          image_provider?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          org_id: string
          platforms?: string[]
          posts_per_cycle?: number
          preferred_days?: number[] | null
          preferred_times?: string[] | null
          recurrence?: string
          reference_accounts?: string[]
          requires_approval?: boolean
          research_topics?: string[]
          research_urls?: string[] | null
          social_account_ids?: string[]
          themes?: Json
          timezone?: string
          tone?: string | null
          updated_at?: string
          user_id: string
          video_model?: string | null
          visual_format?: string
        }
        Update: {
          brand_id?: string | null
          content_types?: string[] | null
          created_at?: string
          id?: string
          image_provider?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          org_id?: string
          platforms?: string[]
          posts_per_cycle?: number
          preferred_days?: number[] | null
          preferred_times?: string[] | null
          recurrence?: string
          reference_accounts?: string[]
          requires_approval?: boolean
          research_topics?: string[]
          research_urls?: string[] | null
          social_account_ids?: string[]
          themes?: Json
          timezone?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
          video_model?: string | null
          visual_format?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_configs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_posts: {
        Row: {
          calendar_id: string
          carousel_data: Json | null
          created_at: string
          error_message: string | null
          hashtags: string[] | null
          id: string
          media_urls: string[] | null
          org_id: string
          pfm_post_id: string | null
          platform: string
          scheduled_at: string | null
          source_topic: string | null
          source_url: string | null
          status: string
          text_content: string
          theme_name: string | null
          updated_at: string
          user_id: string
          visual_creation_id: string | null
          visual_format: string | null
          visual_provider: string | null
        }
        Insert: {
          calendar_id: string
          carousel_data?: Json | null
          created_at?: string
          error_message?: string | null
          hashtags?: string[] | null
          id?: string
          media_urls?: string[] | null
          org_id: string
          pfm_post_id?: string | null
          platform: string
          scheduled_at?: string | null
          source_topic?: string | null
          source_url?: string | null
          status?: string
          text_content: string
          theme_name?: string | null
          updated_at?: string
          user_id: string
          visual_creation_id?: string | null
          visual_format?: string | null
          visual_provider?: string | null
        }
        Update: {
          calendar_id?: string
          carousel_data?: Json | null
          created_at?: string
          error_message?: string | null
          hashtags?: string[] | null
          id?: string
          media_urls?: string[] | null
          org_id?: string
          pfm_post_id?: string | null
          platform?: string
          scheduled_at?: string | null
          source_topic?: string | null
          source_url?: string | null
          status?: string
          text_content?: string
          theme_name?: string | null
          updated_at?: string
          user_id?: string
          visual_creation_id?: string | null
          visual_format?: string | null
          visual_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_posts_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "autopilot_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          avoid_words: string[] | null
          colors: string[] | null
          created_at: string
          description: string | null
          example_posts: string[] | null
          handle: string | null
          id: string
          industry: string | null
          is_default: boolean
          keywords: string[] | null
          logo_url: string | null
          name: string
          org_id: string
          profile_photo_url: string | null
          social_links: Json | null
          system_prompt: string | null
          target_audience: string | null
          tone: string
          updated_at: string
          user_id: string | null
          values: string | null
          website: string | null
        }
        Insert: {
          avoid_words?: string[] | null
          colors?: string[] | null
          created_at?: string
          description?: string | null
          example_posts?: string[] | null
          handle?: string | null
          id?: string
          industry?: string | null
          is_default?: boolean
          keywords?: string[] | null
          logo_url?: string | null
          name: string
          org_id: string
          profile_photo_url?: string | null
          social_links?: Json | null
          system_prompt?: string | null
          target_audience?: string | null
          tone?: string
          updated_at?: string
          user_id?: string | null
          values?: string | null
          website?: string | null
        }
        Update: {
          avoid_words?: string[] | null
          colors?: string[] | null
          created_at?: string
          description?: string | null
          example_posts?: string[] | null
          handle?: string | null
          id?: string
          industry?: string | null
          is_default?: boolean
          keywords?: string[] | null
          logo_url?: string | null
          name?: string
          org_id?: string
          profile_photo_url?: string | null
          social_links?: Json | null
          system_prompt?: string | null
          target_audience?: string | null
          tone?: string
          updated_at?: string
          user_id?: string | null
          values?: string | null
          website?: string | null
        }
        Relationships: []
      }
      creative_offers: {
        Row: {
          brand_id: string | null
          benefits: string[]
          created_at: string
          cta_type: string
          deadline: string | null
          description: string | null
          destination_url: string | null
          differentiators: string[]
          guarantee: string | null
          id: string
          is_archived: boolean
          name: string
          notes: string | null
          objections: string[]
          offer_details: string | null
          offer_mechanism: string[]
          org_id: string
          pain_points: string[]
          price: string | null
          product_images: string[]
          product_type: string
          promise: string | null
          social_proof: string[]
          source_url: string | null
          target_audience: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          brand_id?: string | null
          benefits?: string[]
          created_at?: string
          cta_type?: string
          deadline?: string | null
          description?: string | null
          destination_url?: string | null
          differentiators?: string[]
          guarantee?: string | null
          id?: string
          is_archived?: boolean
          name: string
          notes?: string | null
          objections?: string[]
          offer_details?: string | null
          offer_mechanism?: string[]
          org_id: string
          pain_points?: string[]
          price?: string | null
          product_images?: string[]
          product_type?: string
          promise?: string | null
          social_proof?: string[]
          source_url?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          brand_id?: string | null
          benefits?: string[]
          created_at?: string
          cta_type?: string
          deadline?: string | null
          description?: string | null
          destination_url?: string | null
          differentiators?: string[]
          guarantee?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          notes?: string | null
          objections?: string[]
          offer_details?: string | null
          offer_mechanism?: string[]
          org_id?: string
          pain_points?: string[]
          price?: string | null
          product_images?: string[]
          product_type?: string
          promise?: string | null
          social_proof?: string[]
          source_url?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      creative_sets: {
        Row: {
          angle_count: number
          brand_id: string | null
          created_at: string
          error_message: string | null
          formats: string[]
          id: string
          name: string
          objective: string
          offer_id: string
          options: Json
          org_id: string
          plan: Json
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          angle_count?: number
          brand_id?: string | null
          created_at?: string
          error_message?: string | null
          formats?: string[]
          id?: string
          name: string
          objective?: string
          offer_id: string
          options?: Json
          org_id: string
          plan?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          angle_count?: number
          brand_id?: string | null
          created_at?: string
          error_message?: string | null
          formats?: string[]
          id?: string
          name?: string
          objective?: string
          offer_id?: string
          options?: Json
          org_id?: string
          plan?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      creatives: {
        Row: {
          angle_id: string
          angle_name: string
          brand_id: string | null
          created_at: string
          cta_type: string
          description: string
          format: string
          headline: string
          hook_type: string | null
          id: string
          image_prompt: string | null
          image_url: string | null
          metadata: Json
          offer_id: string
          org_id: string
          primary_text: string
          set_id: string
          sort_order: number
          status: string
          text_overlay: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          angle_id: string
          angle_name: string
          brand_id?: string | null
          created_at?: string
          cta_type?: string
          description?: string
          format: string
          headline?: string
          hook_type?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          metadata?: Json
          offer_id: string
          org_id: string
          primary_text?: string
          set_id: string
          sort_order?: number
          status?: string
          text_overlay?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          angle_id?: string
          angle_name?: string
          brand_id?: string | null
          created_at?: string
          cta_type?: string
          description?: string
          format?: string
          headline?: string
          hook_type?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          metadata?: Json
          offer_id?: string
          org_id?: string
          primary_text?: string
          set_id?: string
          sort_order?: number
          status?: string
          text_overlay?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      creations: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          prompt: string | null
          published: boolean
          source_id: string | null
          template_id: string | null
          template_name: string | null
          thumbnail_url: string | null
          type: string
          urls: string[]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          prompt?: string | null
          published?: boolean
          source_id?: string | null
          template_id?: string | null
          template_name?: string | null
          thumbnail_url?: string | null
          type?: string
          urls?: string[]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          prompt?: string | null
          published?: boolean
          source_id?: string | null
          template_id?: string | null
          template_name?: string | null
          thumbnail_url?: string | null
          type?: string
          urls?: string[]
          user_id?: string | null
        }
        Relationships: []
      }
      post_history: {
        Row: {
          account_id: string
          created_at: string
          error_message: string | null
          id: string
          media_urls: string[] | null
          org_id: string
          platform: string
          post_submission_id: string | null
          public_url: string | null
          published_at: string | null
          scheduled_time: string | null
          status: string
          text_content: string | null
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          media_urls?: string[] | null
          org_id: string
          platform: string
          post_submission_id?: string | null
          public_url?: string | null
          published_at?: string | null
          scheduled_time?: string | null
          status?: string
          text_content?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          media_urls?: string[] | null
          org_id?: string
          platform?: string
          post_submission_id?: string | null
          public_url?: string | null
          published_at?: string | null
          scheduled_time?: string | null
          status?: string
          text_content?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      saved_sources: {
        Row: {
          content: string | null
          created_at: string
          custom_instructions: string | null
          id: string
          org_id: string
          reference_url: string | null
          source_type: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          custom_instructions?: string | null
          id?: string
          org_id: string
          reference_url?: string | null
          source_type: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          custom_instructions?: string | null
          id?: string
          org_id?: string
          reference_url?: string | null
          source_type?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          registration_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          registration_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          registration_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_configs: {
        Row: {
          anthropic_api_key: string | null
          apify_api_token: string | null
          brand_logo_url: string | null
          brand_name: string
          created_at: string
          firecrawl_api_key: string | null
          higgsfield_api_id: string | null
          higgsfield_api_secret: string | null
          id: string
          onboarding_completed: boolean
          org_id: string
          pexels_api_key: string | null
          postforme_api_key: string | null
          unsplash_api_key: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anthropic_api_key?: string | null
          apify_api_token?: string | null
          brand_logo_url?: string | null
          brand_name?: string
          created_at?: string
          firecrawl_api_key?: string | null
          higgsfield_api_id?: string | null
          higgsfield_api_secret?: string | null
          id?: string
          onboarding_completed?: boolean
          org_id: string
          pexels_api_key?: string | null
          postforme_api_key?: string | null
          unsplash_api_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anthropic_api_key?: string | null
          apify_api_token?: string | null
          brand_logo_url?: string | null
          brand_name?: string
          created_at?: string
          firecrawl_api_key?: string | null
          higgsfield_api_id?: string | null
          higgsfield_api_secret?: string | null
          id?: string
          onboarding_completed?: boolean
          org_id?: string
          pexels_api_key?: string | null
          postforme_api_key?: string | null
          unsplash_api_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_vault_secret: { Args: { secret_name: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  core: {
    Tables: {
      app_instances: {
        Row: {
          claim_mode: string
          claimed_at: string | null
          created_at: string
          created_by: string | null
          deploy_url: string | null
          instance_id: string
          intended_owner: string | null
          intended_owner_email: string | null
          org_id: string | null
          solution: string
          source_project_id: string | null
          status: string
        }
        Insert: {
          claim_mode?: string
          claimed_at?: string | null
          created_at?: string
          created_by?: string | null
          deploy_url?: string | null
          instance_id?: string
          intended_owner?: string | null
          intended_owner_email?: string | null
          org_id?: string | null
          solution: string
          source_project_id?: string | null
          status?: string
        }
        Update: {
          claim_mode?: string
          claimed_at?: string | null
          created_at?: string
          created_by?: string | null
          deploy_url?: string | null
          instance_id?: string
          intended_owner?: string | null
          intended_owner_email?: string | null
          org_id?: string | null
          solution?: string
          source_project_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_signup_policy: {
        Row: {
          app: string
          default_role: Database["core"]["Enums"]["app_role"] | null
          first_user_admin: boolean
          registration_enabled: boolean
          require_approval: boolean
        }
        Insert: {
          app: string
          default_role?: Database["core"]["Enums"]["app_role"] | null
          first_user_admin?: boolean
          registration_enabled?: boolean
          require_approval?: boolean
        }
        Update: {
          app?: string
          default_role?: Database["core"]["Enums"]["app_role"] | null
          first_user_admin?: boolean
          registration_enabled?: boolean
          require_approval?: boolean
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          onboarding_completed: boolean
          org_id: string
          role: Database["core"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          org_id: string
          role?: Database["core"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          org_id?: string
          role?: Database["core"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          kind: string | null
          name: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          name: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          has_logged_in: boolean | null
          is_active: boolean
          is_approved: boolean
          must_change_password: boolean | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_logged_in?: boolean | null
          is_active?: boolean
          is_approved?: boolean
          must_change_password?: boolean | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_logged_in?: boolean | null
          is_active?: boolean
          is_approved?: boolean
          must_change_password?: boolean | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      remix_click_logs: {
        Row: {
          clicked_at: string
          id: number
          instance_id: string | null
          metadata: Json
          solution: string | null
          user_id: string | null
        }
        Insert: {
          clicked_at?: string
          id?: never
          instance_id?: string | null
          metadata?: Json
          solution?: string | null
          user_id?: string | null
        }
        Update: {
          clicked_at?: string
          id?: never
          instance_id?: string | null
          metadata?: Json
          solution?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      remix_link: {
        Row: {
          access_level: string
          canonical_project_id: string
          error_message: string | null
          expires_at: string | null
          invite_link: string | null
          last_refreshed_at: string | null
          magic_code_id: string | null
          process_status: string
          retry_count: number
          solution: string
          updated_at: string
        }
        Insert: {
          access_level?: string
          canonical_project_id: string
          error_message?: string | null
          expires_at?: string | null
          invite_link?: string | null
          last_refreshed_at?: string | null
          magic_code_id?: string | null
          process_status?: string
          retry_count?: number
          solution: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          canonical_project_id?: string
          error_message?: string | null
          expires_at?: string | null
          invite_link?: string | null
          last_refreshed_at?: string | null
          magic_code_id?: string | null
          process_status?: string
          retry_count?: number
          solution?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          app: string
          created_at: string
          id: string
          role: Database["core"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          app: string
          created_at?: string
          id?: string
          role: Database["core"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          app?: string
          created_at?: string
          id?: string
          role?: Database["core"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_by_email: { Args: { _solution: string }; Returns: string }
      claim_instance: {
        Args: {
          _deploy_url?: string
          _instance_id: string
          _solution: string
          _source_project_id?: string
        }
        Returns: string
      }
      create_org_for_user: {
        Args: { _kind?: string; _name: string }
        Returns: string
      }
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _app: string
          _role: Database["core"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { _org_id: string }; Returns: boolean }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      is_org_member_path: { Args: { _seg: string }; Returns: boolean }
      org_for_instance: { Args: { _instance_id: string }; Returns: string }
      provision_instance: {
        Args: {
          _claim_mode?: string
          _deploy_url?: string
          _instance_id?: string
          _intended_owner?: string
          _intended_owner_email?: string
          _solution: string
          _source_project_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "agent" | "user" | "member" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      [_ in never]: never
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "app_social">]

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
  app_social: {
    Enums: {},
  },
  core: {
    Enums: {
      app_role: ["admin", "supervisor", "agent", "user", "member", "viewer"],
    },
  },
  public: {
    Enums: {},
  },
} as const
