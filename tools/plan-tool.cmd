@echo off
setlocal
if defined CSIE_NODE_EXE (
  "%CSIE_NODE_EXE%" "%~dp0plan-tool.js" %*
) else (
  node "%~dp0plan-tool.js" %*
)
