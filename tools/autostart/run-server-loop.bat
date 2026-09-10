@echo off
cd /d "C:\Users\Natalie\Desktop\csie_prep_package"
:loop
node server.js
timeout /t 2 /nobreak >nul
goto loop
