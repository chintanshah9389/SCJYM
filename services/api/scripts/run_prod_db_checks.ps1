param(
    [string]$MongoUri = "",
    [string]$ApiBase = "https://scjym-api.onrender.com/api/v1"
)

$ErrorActionPreference = "Stop"

if (-not $MongoUri) {
    $MongoUri = Read-Host "Paste new MONGODB_URI"
}

if (-not $MongoUri) {
    Write-Host "No MONGODB_URI provided. Exiting." -ForegroundColor Red
    exit 2
}

$env:MONGODB_URI = $MongoUri

Write-Host "1) Verifying Atlas URI..." -ForegroundColor Cyan
py -3 scripts/verify_mongo_uri.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Atlas auth check failed. Fix Atlas user/password first." -ForegroundColor Red
    exit 1
}

Write-Host "2) Testing production register/login/menu endpoints..." -ForegroundColor Cyan

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "autotest+$stamp@example.com"
$mobile = "9$((Get-Random -Minimum 100000000 -Maximum 999999999))"
$password = "Password123"

$registerBody = @{
    fullName = "Auto Test"
    email = $email
    mobile = $mobile
    password = $password
    address = @{
        line1 = "x"
        city = "x"
        state = "x"
        pincode = "400001"
    }
} | ConvertTo-Json -Depth 5

try {
    $registerResp = Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/register" -ContentType "application/json" -Body $registerBody
    Write-Host "Register: OK" -ForegroundColor Green
} catch {
    Write-Host "Register failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
    }
    exit 1
}

$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/login" -ContentType "application/json" -Body $loginBody
    Write-Host "Login: OK" -ForegroundColor Green
} catch {
    Write-Host "Login failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
    }
    exit 1
}

try {
    $menuResp = Invoke-RestMethod -Method Get -Uri "$ApiBase/menu"
    Write-Host "Menu: OK" -ForegroundColor Green
} catch {
    Write-Host "Menu failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
    }
    exit 1
}

Write-Host "All checks passed." -ForegroundColor Green
Write-Host "Test user email: $email"
