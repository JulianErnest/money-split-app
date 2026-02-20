/**
 * Supabase Database Types
 *
 * This is a placeholder type file matching the schema in
 * supabase/migrations/00001_initial_schema.sql.
 *
 * Regenerate with:
 *   npx supabase gen types typescript --local > lib/database.types.ts
 *
 * Or from remote:
 *   npx supabase gen types typescript --project-id <your-project-ref> > lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone_number: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          phone_number: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code?: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          user_id?: string;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          group_id: string;
          description: string;
          amount: number;
          paid_by: string;
          split_type: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          description: string;
          amount: number;
          paid_by: string;
          split_type: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          description?: string;
          amount?: number;
          paid_by?: string;
          split_type?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_paid_by_fkey";
            columns: ["paid_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          user_id: string | null;
          pending_member_id: string | null;
          amount: number;
        };
        Insert: {
          id?: string;
          expense_id: string;
          user_id?: string | null;
          pending_member_id?: string | null;
          amount: number;
        };
        Update: {
          id?: string;
          expense_id?: string;
          user_id?: string | null;
          pending_member_id?: string | null;
          amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_splits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_splits_pending_member_id_fkey";
            columns: ["pending_member_id"];
            isOneToOne: false;
            referencedRelation: "pending_members";
            referencedColumns: ["id"];
          },
        ];
      };
      pending_members: {
        Row: {
          id: string;
          group_id: string;
          phone_number: string;
          added_by: string;
          created_at: string;
          nickname: string | null;
          invite_status: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          phone_number: string;
          added_by: string;
          created_at?: string;
          nickname?: string | null;
          invite_status?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          group_id?: string;
          phone_number?: string;
          added_by?: string;
          created_at?: string;
          nickname?: string | null;
          invite_status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pending_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_members_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
          group_id: string;
          paid_by: string;
          paid_to: string;
          amount: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          paid_by: string;
          paid_to: string;
          amount: number;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          paid_by?: string;
          paid_to?: string;
          amount?: number;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_paid_by_fkey";
            columns: ["paid_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_paid_to_fkey";
            columns: ["paid_to"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_group: {
        Args: { group_name: string };
        Returns: string;
      };
      join_group_by_invite: {
        Args: { invite: string };
        Returns: string;
      };
      get_user_group_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      add_pending_member: {
        Args: {
          p_group_id: string;
          p_phone_number: string;
          p_nickname?: string | null;
        };
        Returns: string;
      };
      remove_group_member: {
        Args: {
          p_group_id: string;
          p_member_id: string;
          p_is_pending?: boolean;
        };
        Returns: undefined;
      };
      create_expense: {
        Args: {
          p_group_id: string;
          p_description: string;
          p_amount: number;
          p_paid_by: string;
          p_split_type: string;
          p_splits: Json;
        };
        Returns: string;
      };
      get_group_balances: {
        Args: {
          p_group_id: string;
        };
        Returns: Array<{
          member_id: string;
          is_pending: boolean;
          net_balance: number;
        }>;
      };
      get_my_group_balances: {
        Args: Record<string, never>;
        Returns: Array<{
          group_id: string;
          net_balance: number;
        }>;
      };
      get_my_pending_invites: {
        Args: Record<string, never>;
        Returns: Array<{
          pending_member_id: string;
          group_id: string;
          group_name: string;
          invited_by_name: string;
        }>;
      };
      accept_invite: {
        Args: { p_pending_member_id: string };
        Returns: string;
      };
      decline_invite: {
        Args: { p_pending_member_id: string };
        Returns: undefined;
      };
      record_settlement: {
        Args: {
          p_group_id: string;
          p_paid_by: string;
          p_paid_to: string;
          p_amount: number;
        };
        Returns: string;
      };
      delete_settlement: {
        Args: {
          p_settlement_id: string;
        };
        Returns: undefined;
      };
      get_recent_activity: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_since?: string;
        };
        Returns: Array<{
          id: string;
          type: string;
          description: string;
          amount: number;
          payer_name: string;
          payer_id: string;
          group_name: string;
          group_id: string;
          expense_id: string | null;
          created_at: string;
        }>;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
