import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'

const execPromise = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { apiKey, playlistId } = await request.json()

    // Validate inputs
    if (!apiKey || !playlistId) {
      return NextResponse.json(
        { error: 'Missing apiKey or playlistId' },
        { status: 400 }
      )
    }

    // Path to the Python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'youtube_plasticity.py')
    const outputPath = path.join(process.cwd(), 'public', `plasticity_artifact_${Date.now()}.json`)

    // Check if script exists
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json(
        { error: 'Plasticity script not found' },
        { status: 404 }
      )
    }

    // Execute the Python script
    const { stdout, stderr } = await execPromise(
      `python "${scriptPath}" "${apiKey}" "${playlistId}" "${outputPath}"`,
      {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 300000, // 5 minute timeout
      }
    )

    if (stderr && !stderr.includes('Warning')) {
      console.error('Script stderr:', stderr)
    }

    // Check if output file was created
    try {
      await fs.access(outputPath)
    } catch {
      return NextResponse.json(
        { error: 'Artifact generation failed', details: stderr || stdout },
        { status: 500 }
      )
    }

    // Read the generated artifact
    const artifactContent = await fs.readFile(outputPath, 'utf-8')
    const artifact = JSON.parse(artifactContent)

    // Return the artifact with a relative URL
    return NextResponse.json({
      success: true,
      artifact,
      url: `/plasticity_artifact_${Date.now()}.json`,
      message: 'Plasticity artifact generated successfully',
    })
  } catch (error) {
    console.error('Plasticity API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate plasticity artifact',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
