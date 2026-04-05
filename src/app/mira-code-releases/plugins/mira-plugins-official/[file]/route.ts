import { NextResponse } from 'next/server'

/**
 * /mira-code-releases/plugins/mira-plugins-official/latest
 *   → returns the latest commit SHA (plain text, cached 5min)
 *
 * /mira-code-releases/plugins/mira-plugins-official/{sha}.zip
 *   → proxies the marketplace zip from GitHub (cached immutably)
 *
 * The CLI (officialMarketplaceGcs.ts) appends /latest and /{sha}.zip to GCS_BASE.
 */

const GITHUB_REPO = 'vcorp-ai/mira-plugins-official'
const GITHUB_BRANCH = 'main'

let cachedSha: string | null = null
let cachedShaTime = 0
const SHA_CACHE_TTL = 5 * 60 * 1000

async function getLatestSha(): Promise<string | null> {
  const now = Date.now()
  if (cachedSha && now - cachedShaTime < SHA_CACHE_TTL) {
    return cachedSha
  }

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'vmira-downloads',
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        next: { revalidate: 300 },
      },
    )

    if (!resp.ok) return null

    const data = await resp.json()
    cachedSha = data.sha
    cachedShaTime = now
    return cachedSha
  } catch {
    return cachedSha
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params

  // /latest → return commit SHA
  if (file === 'latest') {
    const sha = await getLatestSha()
    if (!sha) {
      return new NextResponse('Service unavailable', { status: 503 })
    }
    return new NextResponse(sha, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=300',
      },
    })
  }

  // /{sha}.zip → proxy zip from GitHub
  if (file.endsWith('.zip')) {
    const sha = file.replace('.zip', '')
    if (!/^[a-f0-9]{40}$/.test(sha)) {
      return new NextResponse('Invalid SHA', { status: 400 })
    }

    try {
      const zipUrl = `https://github.com/${GITHUB_REPO}/archive/${sha}.zip`
      const resp = await fetch(zipUrl, {
        headers: { 'User-Agent': 'vmira-downloads' },
      })

      if (!resp.ok) {
        return new NextResponse('Zip not found', { status: 404 })
      }

      return new NextResponse(resp.body, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${sha}.zip"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch {
      return new NextResponse('Failed to fetch zip', { status: 502 })
    }
  }

  return new NextResponse('Not found', { status: 404 })
}
