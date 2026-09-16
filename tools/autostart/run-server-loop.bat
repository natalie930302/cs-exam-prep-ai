@echo off
rem Self-restarting server loop. Project root is two levels above this file.
cd /d "%~dp0..\.."
:loop
node server.js
timeout /t 2 /nobreak >nul
goto loop
