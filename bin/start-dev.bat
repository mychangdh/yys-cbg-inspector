@echo off
setlocal
pushd "%~dp0.."
if errorlevel 1 exit /b 1

call npm run dev
set "exitCode=%ERRORLEVEL%"
popd
exit /b %exitCode%
