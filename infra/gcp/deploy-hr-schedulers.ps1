Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RequiredEnvironmentValue {
    param([Parameter(Mandatory = $true)][string]$Name)
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name"
    }
    return $value.Trim()
}

function Set-HttpSchedulerJob {
    param(
        [Parameter(Mandatory = $true)][string]$JobName,
        [Parameter(Mandatory = $true)][string]$Schedule,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$Secret,
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$Region
    )
    $headers = "Content-Type=application/json,x-cron-secret=$Secret"
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        # Listing succeeds with an empty result when the job does not exist.
        # This avoids PowerShell 5.1 promoting gcloud describe's expected
        # NOT_FOUND stderr output to a terminating NativeCommandError.
        $ErrorActionPreference = "Continue"
        $existingJobs = @(& gcloud scheduler jobs list `
            --project $ProjectId `
            --location $Region `
            --format "value(name)")
        $listExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($listExitCode -ne 0) {
        throw "Failed to list Cloud Scheduler jobs before configuring '$JobName'."
    }
    $operation = if ($existingJobs -contains $JobName) { "update" } else { "create" }

    & gcloud scheduler jobs $operation http $JobName `
        --project $ProjectId `
        --location $Region `
        --schedule $Schedule `
        --time-zone "Asia/Ho_Chi_Minh" `
        --uri $Uri `
        --http-method POST `
        --headers $headers `
        --message-body "{}" `
        --attempt-deadline "180s" `
        --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to $operation Cloud Scheduler job $JobName."
    }
    Write-Output "Cloud Scheduler job '$JobName' is configured in '$Region'."
}

$projectId = Get-RequiredEnvironmentValue "GCP_PROJECT_ID"
$region = Get-RequiredEnvironmentValue "GCP_REGION"
$backendBaseUrl = Get-RequiredEnvironmentValue "BE_WMS_BASE_URL"
$leaveSecret = Get-RequiredEnvironmentValue "LEAVE_MAINTENANCE_CRON_SECRET"
$employmentSecret = Get-RequiredEnvironmentValue "EMPLOYEE_EMPLOYMENT_CRON_SECRET"
if ($backendBaseUrl -notmatch "^https://") {
    throw "BE_WMS_BASE_URL must use HTTPS."
}
$baseUrl = $backendBaseUrl.TrimEnd("/")

Set-HttpSchedulerJob `
    -JobName "employee-employment-transitions-daily" `
    -Schedule "1 0 * * *" `
    -Uri "$baseUrl/api/employee-profiles/cron/employment-transitions/apply-due" `
    -Secret $employmentSecret `
    -ProjectId $projectId `
    -Region $region

Set-HttpSchedulerJob `
    -JobName "leave-maintenance-daily" `
    -Schedule "5 0 * * *" `
    -Uri "$baseUrl/api/leave/cron/maintenance" `
    -Secret $leaveSecret `
    -ProjectId $projectId `
    -Region $region
