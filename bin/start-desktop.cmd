@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0.."

if not exist "node_modules" (
  echo 未找到 node_modules，请先在项目目录执行 yarn install。
  pause
  exit /b 1
)

call yarn tauri:dev
set "exitCode=%errorlevel%"
if not "%exitCode%"=="0" pause
exit /b %exitCode%
