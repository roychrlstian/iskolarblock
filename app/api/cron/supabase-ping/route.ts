import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (
      process.env.NODE_ENV === "production" &&
      request.headers.get("x-vercel-cron") !== "1"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          error: "Supabase environment variables are missing",
        },
        { status: 500 }
      );
    }

    const pingUrl = new URL("/auth/v1/health", supabaseUrl);

    const upstreamResponse = await fetch(pingUrl, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      const responseText = await upstreamResponse.text();

      return NextResponse.json(
        {
          error: "Failed to ping Supabase",
          status: upstreamResponse.status,
          details: responseText,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Supabase pinged successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}