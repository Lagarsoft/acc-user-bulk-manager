import { redirect } from "next/navigation";
import { getAuthorizationUrl } from "@/app/lib/aps-auth";
import { NextRequest } from "next/server";
import { randomBytes } from "crypto";

export function GET(req: NextRequest) {
  // Generate a random state value to prevent CSRF.
  const state = randomBytes(16).toString("hex");

  // The state is short-lived (validated in the callback), so we store it
  // in a URL query param echoed back by APS and re-read in the callback.
  // For production hardening, store in a signed session cookie instead.
  void req; // req unused here but kept for conventional Next.js handler signature

  const url = getAuthorizationUrl(state);
  redirect(url);
}
