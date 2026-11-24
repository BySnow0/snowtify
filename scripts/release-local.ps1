<#
.SYNOPSIS
  Local replacement for the upstream-sync + release GitHub Actions workflows.

.DESCRIPTION
  Checks the latest spicetify/cli release. If Snowtify has not shipped it yet:
  merges it into main in a dedicated clone, verifies the build, cross-compiles
  every platform, packages them like build.yml does, pushes main + tag and
  publishes the GitHub release with `gh`. On merge conflicts it pushes a
  sync/upstream-<tag> branch and opens a PR instead.

  Needs: git, gh (logged in as the repo owner), Go, Node (npx), Git for Windows (tar/gzip).

.EXAMPLE
  .\scripts\release-local.ps1 -DryRun          # build everything, publish nothing
  .\scripts\release-local.ps1                  # sync + publish if needed
  .\scripts\release-local.ps1 -UpstreamTag v2.46.7 -Force
#>
[CmdletBinding()]
param(
  [string]$UpstreamTag,
  [string]$Branch = 'main',
  [switch]$Force,
  [switch]$DryRun,
  [string]$WorkDir = "$env:LOCALAPPDATA\snowtify-release"
)

# Cmdlets stop on error; native tools (git, go...) write progress to stderr, so
# they are judged by exit code instead (Windows PowerShell 5.1 would throw).
$ErrorActionPreference = 'Continue'
$PSDefaultParameterValues['*:ErrorAction'] = 'Stop'
$Repo = 'SnoW-099/snowtify'
$Upstream = 'spicetify/cli'
$PackagedPaths = @('CustomApps', 'Extensions', 'Themes', 'jsHelper', 'globals.d.ts', 'css-map.json')
$Targets = @(
  @{ os = 'windows'; arch = 'amd64'; label = 'x64' },
  @{ os = 'windows'; arch = 'arm64'; label = 'arm64' },
  @{ os = 'windows'; arch = '386'; label = 'x32' },
  @{ os = 'linux'; arch = 'amd64'; label = 'amd64' },
  @{ os = 'darwin'; arch = 'amd64'; label = 'amd64' },
  @{ os = 'darwin'; arch = 'arm64'; label = 'arm64' }
)

New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
$LogPath = Join-Path $WorkDir 'sync.log'
function Write-Log([string]$Message) {
  $line = "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $Message
  Write-Host $line
  Add-Content -LiteralPath $LogPath -Value $line -Encoding utf8
}

# Native commands: fail loudly on non-zero exit codes.
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Exe $($Arguments -join ' ') failed with exit code $LASTEXITCODE" }
}

foreach ($dir in @("$env:ProgramFiles\Go\bin", "$env:ProgramFiles\Git\usr\bin")) {
  if ((Test-Path $dir) -and (($env:PATH -split ';') -notcontains $dir)) { $env:PATH = "$dir;$env:PATH" }
}
$GitTar = "$env:ProgramFiles\Git\usr\bin\tar.exe"
$GitGzip = "$env:ProgramFiles\Git\usr\bin\gzip.exe"
foreach ($tool in @('git', 'gh', 'go', 'npx')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing required tool: $tool" }
}
foreach ($tool in @($GitTar, $GitGzip)) {
  if (-not (Test-Path $tool)) { throw "Missing $tool (install Git for Windows)" }
}

try {
  # 1. Which upstream version, and does Snowtify already ship it?
  if (-not $UpstreamTag) { $UpstreamTag = (gh api "repos/$Upstream/releases/latest" --jq .tag_name).Trim() }
  $upstreamVersion = $UpstreamTag.TrimStart('v')
  $releaseTags = @(gh api "repos/$Repo/releases?per_page=100" --jq '.[].tag_name')
  if ((@($releaseTags | Where-Object { $_ -like "v$upstreamVersion-snow.*" }).Count -gt 0) -and -not $Force) {
    Write-Log "Up to date: Snowtify already ships upstream $UpstreamTag."
    return
  }
  $remoteTags = @(git ls-remote --tags "https://github.com/$Repo.git" | ForEach-Object { ($_ -split "`t")[1] })
  $n = 1
  while ($remoteTags -contains "refs/tags/v$upstreamVersion-snow.$n") { $n++ }
  $version = "$upstreamVersion-snow.$n"
  $tag = "v$version"
  Write-Log "Syncing upstream $UpstreamTag as $tag (branch $Branch, dry run: $DryRun)"

  # 2. Dedicated clone so the scheduled task never touches your working copy.
  $clone = Join-Path $WorkDir 'repo'
  if (-not (Test-Path (Join-Path $clone '.git'))) {
    Invoke-Native git @('clone', '-c', 'core.autocrlf=false', "https://github.com/$Repo.git", $clone)
  }
  Push-Location $clone
  try {
    Invoke-Native git @('config', 'user.name', 'SnoW-099')
    Invoke-Native git @('config', 'user.email', '204031946+SnoW-099@users.noreply.github.com')
    Invoke-Native git @('config', 'core.autocrlf', 'false')
    git remote get-url upstream 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { Invoke-Native git @('remote', 'add', 'upstream', "https://github.com/$Upstream.git") }
    Invoke-Native git @('fetch', '--prune', 'origin')
    Invoke-Native git @('fetch', '--no-tags', 'upstream', "+refs/tags/${UpstreamTag}:refs/upstream-tag")
    Invoke-Native git @('checkout', '-f', '-B', $Branch, "origin/$Branch")
    Invoke-Native git @('reset', '--hard', "origin/$Branch")
    Invoke-Native git @('clean', '-fdx', '-e', 'node_modules')

    # 3. Merge upstream.
    git merge-base --is-ancestor refs/upstream-tag HEAD
    if ($LASTEXITCODE -eq 0) {
      Write-Log "Upstream $UpstreamTag is already merged into $Branch."
    }
    else {
      git merge --no-ff refs/upstream-tag -m "Sync upstream Spicetify $UpstreamTag"
      if ($LASTEXITCODE -ne 0) {
        git merge --abort
        $syncBranch = "sync/upstream-$UpstreamTag"
        Write-Log "CONFLICT merging $UpstreamTag. Opening PR from $syncBranch."
        if (-not $DryRun) {
          Invoke-Native git @('push', '--force', 'origin', "refs/upstream-tag:refs/heads/$syncBranch")
          $open = gh pr list -R $Repo --head $syncBranch --state open --json number --jq '.[0].number'
          if (-not $open) {
            Invoke-Native gh @('pr', 'create', '-R', $Repo, '--base', $Branch, '--head', $syncBranch,
              '--title', "Sync upstream Spicetify $UpstreamTag (conflicts)",
              '--body', "Automatic sync could not merge ``$UpstreamTag`` cleanly. Resolve the conflicts and merge; the next run of ``scripts/release-local.ps1`` publishes ``$tag``.")
          }
        }
        exit 2
      }
    }

    # 4. Verify: same checks as build.yml.
    Write-Log 'Verifying wrapper, Go build and tests...'
    Invoke-Native npx @('-y', 'pnpm@11.9.0', 'install', '--frozen-lockfile')
    Invoke-Native npx @('-y', 'pnpm@11.9.0', 'build:wrapper')
    Invoke-Native npx @('-y', 'pnpm@11.9.0', 'check:wrapper')
    Invoke-Native go @('build', '-o', "$env:TEMP\snowtify-verify.exe", '.')
    Invoke-Native go @('test', './...')

    # 5. Cross-compile and package like build.yml.
    $dist = Join-Path $WorkDir "dist\$tag"
    if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
    New-Item -ItemType Directory -Force -Path $dist | Out-Null
    $assets = @()
    $env:CGO_ENABLED = '0'
    foreach ($t in $Targets) {
      $env:GOOS = $t.os; $env:GOARCH = $t.arch
      $binName = if ($t.os -eq 'windows') { 'snowtify.exe' } else { 'snowtify' }
      $stage = Join-Path $WorkDir "stage"
      if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
      New-Item -ItemType Directory -Force -Path $stage | Out-Null
      Invoke-Native go @('build', '-trimpath', '-ldflags', "-X main.version=$version", '-o', (Join-Path $stage $binName), '.')
      foreach ($p in $PackagedPaths) { Copy-Item -Recurse -Force -LiteralPath $p -Destination $stage }

      $base = "snowtify-$version-$($t.os)-$($t.label)"
      Push-Location $stage
      try {
        if ($t.os -eq 'windows') {
          $asset = Join-Path $dist "$base.zip"
          Invoke-Native "$env:SystemRoot\System32\tar.exe" (@('-a', '-c', '-f', $asset, $binName) + $PackagedPaths)
        }
        else {
          # GNU tar so the binary is stored executable even though NTFS has no mode bits.
          $tarFile = Join-Path $dist "$base.tar"
          $tarPath = $tarFile -replace '\\', '/'
          Invoke-Native $GitTar @('--force-local', '-cf', $tarPath, '--owner=0', '--group=0', '--mode=755', $binName)
          Invoke-Native $GitTar (@('--force-local', '-rf', $tarPath, '--owner=0', '--group=0', '--mode=u+rw,go+r,a+X') + $PackagedPaths)
          Invoke-Native $GitGzip @('-9', '-f', $tarPath)
          $asset = "$tarFile.gz"
        }
      }
      finally { Pop-Location }
      $assets += $asset
      Write-Log "Built $(Split-Path $asset -Leaf)"
    }
    Remove-Item Env:GOOS, Env:GOARCH, Env:CGO_ENABLED

    if ($DryRun) {
      Write-Log "Dry run finished. Assets in $dist (nothing pushed or published)."
      return
    }

    # 6. Publish.
    Invoke-Native git @('push', 'origin', "HEAD:$Branch")
    Invoke-Native git @('tag', '-a', $tag, '-m', "Snowtify $tag (upstream $UpstreamTag)")
    Invoke-Native git @('push', 'origin', $tag)
    $notes = "Sync with [Spicetify $UpstreamTag](https://github.com/$Upstream/releases/tag/$UpstreamTag).`n`nUpdate with ``snowtify update``."
    Invoke-Native gh (@('release', 'create', $tag, '-R', $Repo, '--verify-tag', '--latest', '--title', "Snowtify $tag", '--notes', $notes) + $assets)
    Write-Log "Published $tag."
  }
  finally { Pop-Location }
}
catch {
  Write-Log "FAILED: $($_.Exception.Message)"
  exit 1
}
