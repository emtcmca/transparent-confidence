# capture-gh-traffic.ps1
# Snapshots GitHub traffic + repo stats + npm downloads for transparent-confidence.
#
# Why this exists: GitHub only retains traffic data (views/clones) for 14 days.
# Run this weekly (Task Scheduler) or the launch-week numbers are lost forever.
#
# Requires: gh CLI authenticated with push access to the repo.
# Output (both local-only, never committed):
#   marketing/data/gh-traffic.csv              — one summary row per run
#   marketing/data/raw/gh-traffic-<date>.json  — full daily breakdowns + referrers

$ErrorActionPreference = 'Stop'

$repo = 'emtcmca/transparent-confidence'
$pkg = 'transparent-confidence'
$root = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $root 'marketing\data'
$rawDir = Join-Path $dataDir 'raw'
$csv = Join-Path $dataDir 'gh-traffic.csv'
$date = Get-Date -Format 'yyyy-MM-dd'

New-Item -ItemType Directory -Force $rawDir | Out-Null

# --- Pull metrics ----------------------------------------------------------

$views = gh api "repos/$repo/traffic/views" | ConvertFrom-Json
$clones = gh api "repos/$repo/traffic/clones" | ConvertFrom-Json
$referrers = gh api "repos/$repo/traffic/popular/referrers" | ConvertFrom-Json
$paths = gh api "repos/$repo/traffic/popular/paths" | ConvertFrom-Json
$repoInfo = gh api "repos/$repo" | ConvertFrom-Json

# npm weekly downloads (registry-wide, includes mirror/scanner bots — track trend, not absolute)
try {
    $npmWeekly = (Invoke-RestMethod "https://api.npmjs.org/downloads/point/last-week/$pkg").downloads
} catch {
    $npmWeekly = ''
}

# --- Append summary row ----------------------------------------------------

if (-not (Test-Path $csv)) {
    'date,views_14d,unique_visitors_14d,clones_14d,unique_cloners_14d,stars,forks,watchers,open_issues,npm_downloads_last_week' |
        Out-File $csv -Encoding utf8
}

"$date,$($views.count),$($views.uniques),$($clones.count),$($clones.uniques),$($repoInfo.stargazers_count),$($repoInfo.forks_count),$($repoInfo.subscribers_count),$($repoInfo.open_issues_count),$npmWeekly" |
    Out-File $csv -Append -Encoding utf8

# --- Save raw daily breakdowns (lossless record for later analysis) --------

@{
    capturedAt = $date
    views      = $views
    clones     = $clones
    referrers  = $referrers
    paths      = $paths
    stars      = $repoInfo.stargazers_count
    forks      = $repoInfo.forks_count
    npmWeekly  = $npmWeekly
} | ConvertTo-Json -Depth 6 | Out-File (Join-Path $rawDir "gh-traffic-$date.json") -Encoding utf8

Write-Output "Captured $date -> views $($views.count) ($($views.uniques) unique) | clones $($clones.count) ($($clones.uniques) unique) | stars $($repoInfo.stargazers_count) | npm/wk $npmWeekly"
