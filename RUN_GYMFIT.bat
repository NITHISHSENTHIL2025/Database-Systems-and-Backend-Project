@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GymFit Launcher

echo.
echo =====================================================
echo                       GYMFIT
echo =====================================================
echo.

where node >nul 2>nul || (
  echo [ERROR] Node.js is not installed or not on PATH.
  pause
  exit /b 1
)
where npm >nul 2>nul || (
  echo [ERROR] npm is not available.
  pause
  exit /b 1
)

if not exist "backend\.env" (
  echo [ERROR] backend\.env is missing.
  echo Copy backend\.env.example to backend\.env and paste your existing Neon/Cashfree settings.
  pause
  exit /b 1
)
if not exist "frontend\.env" (
  copy /Y "frontend\.env.example" "frontend\.env" >nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":4000 .*LISTENING"') do taskkill /PID %%a /F >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":5173 .*LISTENING"') do taskkill /PID %%a /F >nul 2>nul

echo [1/6] Backend packages...
pushd backend
call npm install
if errorlevel 1 goto :fail

echo [2/6] Prisma client + safe database sync...
call npx prisma generate
if errorlevel 1 goto :fail
call npx prisma db push
if errorlevel 1 goto :fail
call npm run db:seed
if errorlevel 1 goto :fail
popd

echo [3/6] Face Attendance assets...
if not exist "frontend\public\vendor\face-api.min.js" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP_FACE_ENGINE.ps1"
  if errorlevel 1 echo [WARN] Face engine download failed. Gym Key attendance fallback will still work.
) else (
  echo Face engine already installed.
)

echo [4/6] Frontend packages...
pushd frontend
call npm install
if errorlevel 1 goto :fail
popd

echo [5/6] Starting API...
start "GymFit API" cmd /k "cd /d ""%~dp0backend"" && npm start"

echo Waiting for API health...
powershell -NoProfile -Command "$ok=$false; 1..24 | ForEach-Object { try { $r=Invoke-RestMethod 'http://127.0.0.1:4000/api/health' -TimeoutSec 2; if($r.ok){$ok=$true; break} } catch {}; Start-Sleep -Milliseconds 700 }; if(-not $ok){exit 1}"
if errorlevel 1 (
  echo [ERROR] API health check failed. Read the GymFit API window.
  pause
  exit /b 1
)

echo [6/6] Starting web app...
start "GymFit Web" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5173"

echo.
echo =====================================================
echo GymFit is running.
echo Local: http://127.0.0.1:5173
echo.
echo Phone / same Wi-Fi:
powershell -NoProfile -Command "$ip=(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {$_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'} | Select-Object -First 1 -ExpandProperty IPAddress); if($ip){Write-Host ('  http://' + $ip + ':5173')}else{Write-Host '  Local LAN IP not detected.'}"
echo.
echo Desktop Face Attendance: live camera works on localhost.
echo Phone Face Attendance: use Take photo / Choose photo if live camera is blocked on LAN HTTP.
echo =====================================================
exit /b 0

:fail
popd 2>nul
echo.
echo [ERROR] Setup stopped because a command failed.
pause
exit /b 1
