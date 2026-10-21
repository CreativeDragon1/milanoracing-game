@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 "Milano LAN Server.py"
) else (
  python "Milano LAN Server.py"
)
echo.
echo Server stopped. If Python is missing, install Python 3 from python.org.
pause
