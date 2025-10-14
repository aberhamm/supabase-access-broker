export interface User {
  id: string;
  email: string;
  app_metadata: Record<string, any>;
  raw_app_meta_data?: Record<string, any>;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
}

export interface ClaimOperation {
  uid: string;
  claim: string;
  value?: any;
}

export interface ClaimValue {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
}

export interface UserStats {
  totalUsers: number;
  claimsAdmins: number;
  totalClaims: number;
  recentSignups: number;
}

export interface ClaimDistribution {
  claim: string;
  count: number;
}
