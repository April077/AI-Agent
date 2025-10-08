import NextAuth, { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;                // add user id
      accessToken?: string;      // optional access token
      refreshToken?: string;     // optional refresh token
    } & DefaultSession["user"];
  }

  interface JWT extends DefaultJWT {
    id: string;
    accessToken?: string;
    refreshToken?: string;
  }
}
