@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
set PY=py
where py >nul 2>&1 || set PY=python
%PY% -c "import uiautomation" >nul 2>&1 || %PY% -m pip install --user uiautomation
%PY% tools\caption-recorder.py
pause
