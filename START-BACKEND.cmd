@echo off
setlocal
cd /d "%~dp0"
set "ASPNETCORE_ENVIRONMENT=Development"
set "LocalDatabasePath=%~dp0backend\src\CRMSystem.Api\data\crm-system-dev.db"
set "UPLOADS_ROOT=%~dp0backend\src\CRMSystem.Api\data\uploads"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5241/health -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
  echo CRM System API is already running at http://localhost:5241
  echo You do not need to start it a second time.
  exit /b 0
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -State Listen -LocalPort 5241 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo Port 5241 is being used by another application.
  echo Close that application and run START-BACKEND.cmd again.
  pause
  exit /b 1
)
echo Starting CRM System API at http://localhost:5241
echo Local data is stored persistently in backend\src\CRMSystem.Api\data\crm-system-dev.db
echo Uploaded documents are stored persistently in backend\src\CRMSystem.Api\data\uploads
if not exist "%~dp0backend\src\CRMSystem.Api\bin" (
  echo Restoring backend packages with the local NuGet configuration...
  dotnet restore backend\src\CRMSystem.Api\CRMSystem.Api.csproj --configfile "%~dp0NuGet.Config"
  if errorlevel 1 pause & exit /b 1
)
dotnet run --project backend\src\CRMSystem.Api --no-restore
if errorlevel 1 pause
