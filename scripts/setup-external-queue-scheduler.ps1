param(
  [string]$ProjectId = "jw-system-f2104",
  [string]$Region = "asia-southeast1",
  [string]$ServiceName = "be-wms",
  [string]$JobName = "external-queue-auto-submit",
  [string]$Schedule = "0 14,22 * * *",
  [string]$TimeZone = "Asia/Ho_Chi_Minh",
  [Parameter(Mandatory = $true)]
  [string]$CronSecret
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "gcloud was not found. Install Google Cloud SDK or run this script in Cloud Shell."
}

if ($CronSecret.Contains(",")) {
  throw "CronSecret must not contain a comma because gcloud scheduler headers are comma-delimited."
}

$serviceUrl = gcloud run services describe $ServiceName `
  --region $Region `
  --project $ProjectId `
  --format "value(status.url)"

if (-not $serviceUrl) {
  throw "Could not resolve Cloud Run service URL for $ServiceName in $ProjectId/$Region."
}

$targetUri = "$serviceUrl/api/external-queue/cron/auto-submit"
$headers = "Content-Type=application/json,x-cron-secret=$CronSecret"

gcloud services enable cloudscheduler.googleapis.com --project $ProjectId

gcloud run services update $ServiceName `
  --region $Region `
  --project $ProjectId `
  --update-env-vars "^|^EXTERNAL_QUEUE_AUTO_SUBMIT_CRON_SECRET=$CronSecret|EXTERNAL_QUEUE_AUTO_SUBMIT_WORKER_ENABLED=false|EXTERNAL_QUEUE_AUTO_SUBMIT_TIMES=14:00,22:00"

gcloud scheduler jobs describe $JobName `
  --location $Region `
  --project $ProjectId *> $null

if ($LASTEXITCODE -eq 0) {
  gcloud scheduler jobs update http $JobName `
    --location $Region `
    --project $ProjectId `
    --schedule $Schedule `
    --time-zone $TimeZone `
    --uri $targetUri `
    --http-method POST `
    --update-headers $headers `
    --attempt-deadline 300s `
    --max-retry-attempts 3
} else {
  gcloud scheduler jobs create http $JobName `
    --location $Region `
    --project $ProjectId `
    --schedule $Schedule `
    --time-zone $TimeZone `
    --uri $targetUri `
    --http-method POST `
    --headers $headers `
    --attempt-deadline 300s `
    --max-retry-attempts 3 `
    --description "Run external queue auto-submit at 14:00 and 22:00 GMT+7"
}

Write-Host "Cloud Scheduler job is configured:"
Write-Host "  Job:      $JobName"
Write-Host "  Schedule: $Schedule ($TimeZone)"
Write-Host "  Target:   $targetUri"
