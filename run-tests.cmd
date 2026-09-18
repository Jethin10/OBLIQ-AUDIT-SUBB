@echo off
rem Deterministic test cycle: stop server, wipe data files, reseed once,
rem start a fresh server, wait for health, run the acceptance suite.
setlocal EnableExtensions EnableDelayedExpansion
cd /d %~dp0

rem --- 1. stop whatever listens on 3000 (only that process) ---
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
timeout /t 1 /nobreak >nul

rem --- 2. wipe the database files outright (server is dead now, safe) ---
del /q data\audit.db data\audit.db-wal data\audit.db-shm >nul 2>&1

rem --- 3. reseed once from scratch ---
node scripts\seed.mjs > seed-out.log 2>&1
if errorlevel 1 (
  echo SEED_FAILED > test-exit.txt
  type seed-out.log
  exit /b 1
)

rem --- 4. start a fresh dev server ---
start "" /b node node_modules\next\dist\bin\next dev > dev-server.log 2>&1

rem --- 5. wait until it actually answers ---
node scripts\wait-health.mjs > health.log 2>&1
if errorlevel 1 (
  echo SERVER_TIMEOUT > test-exit.txt
  type health.log
  exit /b 1
)

rem --- 6. run the acceptance suite (preserve its exit code for CI) ---
node --test tests\api.test.mjs > test-out.log 2>&1
set TEST_EXIT=!errorlevel!
echo EXIT:!TEST_EXIT! > test-exit.txt
type test-out.log
exit /b !TEST_EXIT!

