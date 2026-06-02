import CredentialsProvider from "next-auth/providers/credentials";
import axios from "axios";

const API = process.env.API_BASE_URL ?? "http://localhost:8000/api/v1";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const { data } = await axios.post(`${API}/auth/login`, {
            email: credentials?.email,
            password: credentials?.password,
          });
          const { user, accessToken, refreshToken } = data.data;
          if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
            throw new Error("ADMIN_ONLY");
          }
          if (user.status !== "APPROVED") {
            throw new Error("APPROVAL_PENDING");
          }
          return { ...user, accessToken, refreshToken };
        } catch (err: any) {
          const msg =
            err?.response?.data?.error?.message ??
            err.message ??
            "Login failed";
          throw new Error(msg);
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      session.user.role = token.role;
      session.user.id = token.id;
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};
