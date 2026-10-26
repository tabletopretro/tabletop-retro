"use server";

import { redirect } from "next/navigation";
import { LOCAL_SIGN_IN_ENABLED } from "@/lib/auth/config";
import { createLocalUser, isLocalUser } from "@/lib/auth/local";
import { createSession, deleteSession } from "@/lib/auth/session";

// Every export is a public endpoint and guards itself. No SSO action until a provider really verifies identities.

export async function signInAsLocalUser(formData: FormData) {
  if (!LOCAL_SIGN_IN_ENABLED) redirect("/sign-in");
  const userId = formData.get("userId");
  if (typeof userId !== "string" || !isLocalUser(userId)) redirect("/sign-in");
  await createSession(userId);
  redirect("/library");
}

export type CreateLocalUserState = { error: string | null };

const NAME_MAX = 40;

export async function createLocalUserAndSignIn(
  _prev: CreateLocalUserState,
  formData: FormData,
): Promise<CreateLocalUserState> {
  if (!LOCAL_SIGN_IN_ENABLED) return { error: "Local sign-in is off" };
  const raw = formData.get("name");
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!name) return { error: "Add a name" };
  if (name.length > NAME_MAX) return { error: `${NAME_MAX} characters at most` };
  await createSession(createLocalUser(name));
  redirect("/library");
}

export async function signOut() {
  await deleteSession();
  redirect("/");
}
