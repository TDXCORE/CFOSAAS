# Kill all development servers script
# Run this if you have port issues: powershell -ExecutionPolicy Bypass -File scripts/kill-dev-servers.ps1

Write-Host "🔍 Searching for development servers on ports 3000-3009..."

$ports = 3000..3009
$killed = 0

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.State -eq "Listen") {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "🔪 Killing process $($process.Name) (PID: $($process.Id)) on port $port"
                Stop-Process -Id $process.Id -Force
                $killed++
            }
        }
    }
}

if ($killed -eq 0) {
    Write-Host "✅ No development servers found running"
} else {
    Write-Host "🎉 Killed $killed development server(s)"
}

Write-Host "🚀 Ports 3000-3009 are now available"