import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const LOG_DIR = path.join(process.cwd(), "data", "plasticity-logs")

type LogPayload = {
  sessionId?: string
  events?: unknown[]
  sentAt?: number
}

function sanitizeSessionId(sessionId: string) {
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LogPayload
    const sessionId = body.sessionId?.trim()
    const events = body.events

    if (!sessionId || !Array.isArray(events)) {
      return NextResponse.json({ error: "Missing sessionId or events[]" }, { status: 400 })
    }

    const safeSessionId = sanitizeSessionId(sessionId)
    if (!safeSessionId) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
    }

    await fs.mkdir(LOG_DIR, { recursive: true })
    const filePath = path.join(LOG_DIR, `${safeSessionId}.jsonl`)
    const lines = events.map((event) => JSON.stringify(event)).join("\n")
    if (lines.length > 0) {
      await fs.appendFile(filePath, `${lines}\n`, "utf-8")
    }

    return NextResponse.json({
      ok: true,
      sessionId: safeSessionId,
      appended: events.length,
      receivedAt: Date.now(),
    })
  } catch (error) {
    console.error("Plasticity log sink error:", error)
    return NextResponse.json(
      {
        error: "Failed to persist plasticity logs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim()
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId query parameter" }, { status: 400 })
    }

    const safeSessionId = sanitizeSessionId(sessionId)
    const filePath = path.join(LOG_DIR, `${safeSessionId}.jsonl`)
    const content = await fs.readFile(filePath, "utf-8")
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to read plasticity log session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 404 }
    )
  }
}
