import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  throw new Error(`Invalid VITE_SUPABASE_URL format: ${supabaseUrl}. Please ensure it's a valid URL like https://your-project-ref.supabase.co`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      parsing_sessions: {
        Row: {
          id: string;
          url: string;
          mode: 'email' | 'links' | 'data' | 'html';
          status: 'running' | 'completed' | 'failed' | 'stopped';
          proxy_enabled: boolean;
          proxy_url: string | null;
          results_count: number;
          created_at: string;
          completed_at: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          url: string;
          mode: 'email' | 'links' | 'data' | 'html';
          status?: 'running' | 'completed' | 'failed' | 'stopped';
          proxy_enabled?: boolean;
          proxy_url?: string | null;
          results_count?: number;
          created_at?: string;
          completed_at?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          url?: string;
          mode?: 'email' | 'links' | 'data' | 'html';
          status?: 'running' | 'completed' | 'failed' | 'stopped';
          proxy_enabled?: boolean;
          proxy_url?: string | null;
          results_count?: number;
          created_at?: string;
          completed_at?: string | null;
          user_id?: string;
        };
      };
      parsing_results: {
        Row: {
          id: string;
          session_id: string;
          type: 'email' | 'link' | 'data' | 'html';
          title: string;
          content: string;
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          type: 'email' | 'link' | 'data' | 'html';
          title: string;
          content: string;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          type?: 'email' | 'link' | 'data' | 'html';
          title?: string;
          content?: string;
          source?: string | null;
          created_at?: string;
        };
      };
    };
  };
};