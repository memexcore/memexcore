export interface Session {
  session_id: string;
  user_id: string;
  pages: string[];
  exp: number;
  revoked: boolean;
}

export interface HmacKeyPair {
  current: string;
  previous: string | null;
}
