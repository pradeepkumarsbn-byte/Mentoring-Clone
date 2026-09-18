import type { NextRequest } from "next/server";
import { handlers, authConfigured } from "../../../../auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return authConfigured() ? handlers.GET(request) : Response.json({error:"Google sign-in is not configured yet."},{status:503}); }
export async function POST(request: NextRequest) { return authConfigured() ? handlers.POST(request) : Response.json({error:"Google sign-in is not configured yet."},{status:503}); }
