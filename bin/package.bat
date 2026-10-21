@echo off
setlocal
pushd "%~dp0.."
if errorlevel 1 exit /b 1

call npm run build
set "exitCode=%ERRORLEVEL%"
popd
echo.
pause
exit /b %exitCode%
