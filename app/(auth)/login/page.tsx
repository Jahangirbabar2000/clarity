import { LoginCard } from "./login-card";

export default function LoginPage() {
  const githubEnabled = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
  );
  return <LoginCard githubEnabled={githubEnabled} />;
}
