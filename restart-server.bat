@echo off
rem Restart CSIE Prep Hub (port 3210) + Live Captions recorder
cd /d "%~dp0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3210" ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq CaptionRecorder*" /F >nul 2>&1
timeout /t 1 /nobreak >nul
start "CSIE Prep Hub" /min cmd /k "npm start"
rem --- Live Captions + recorder ---
set PY=py
where py >nul 2>&1 || set PY=python
%PY% -c "import uiautomation" >nul 2>&1 || %PY% -m pip install --user --quiet uiautomation
start "" "%SystemRoot%\System32\LiveCaptions.exe"
start "CaptionRecorder" /min cmd /k "set PYTHONIOENCODING=utf-8&& chcp 65001 >nul && %PY% tools\caption-recorder.py"
timeout /t 3 /nobreak >nul
start "" http://localhost:3210
