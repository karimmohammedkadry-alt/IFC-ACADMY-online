$ErrorActionPreference = 'Stop'
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskName = 'IFC Academy - Supabase Sync (Every Minute)'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Host 'Node.js 20+ غير موجود. ثبّت Node.js ثم شغّل السكربت مرة أخرى.' -ForegroundColor Yellow
  exit 1
}
$config = Join-Path $agentDir 'config.json'
if (-not (Test-Path $config)) {
  Copy-Item (Join-Path $agentDir 'config.example.json') $config
  Write-Host "تم إنشاء config.json. ضع بيانات Supabase فيه ثم شغّل السكربت مرة أخرى." -ForegroundColor Yellow
  exit 1
}
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$agentDir\sync-agent.mjs`"" -WorkingDirectory $agentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'IFC Academy local Supabase synchronization every 60 seconds' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'تم تثبيت وتشغيل مزامنة IFC Academy كل دقيقة.' -ForegroundColor Green
Write-Host 'المجلد: C:\IFC_ACADEMY_DATA'
