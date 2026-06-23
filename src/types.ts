export type Env = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  RESEND_API_KEY: string;
  APP_URL: string;
  ALLOWED_ORIGINS?: string;
  SKIP_EMAIL_VERIFICATION?: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Variables = {
  user: User;
};
