import { auth, authConfigured } from "../auth";
export async function getChatGPTUser() {
  if (!authConfigured()) return null;
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  return { email, displayName: session?.user?.name || email, fullName: session?.user?.name || null };
}
export function chatGPTSignInPath(_returnTo: string) { return "/login"; }
