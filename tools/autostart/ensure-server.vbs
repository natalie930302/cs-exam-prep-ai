' Idempotent watchdog: starts the CSIE Prep Hub server (via the
' self-restarting loop in run-server-loop.bat) if it isn't already
' answering on http://localhost:3210. Safe to run repeatedly - does nothing
' but exit if the server is already up, so it never spawns a second instance
' and never opens a browser window on its own. Task Scheduler isn't
' available in this environment to re-run this periodically, so the
' resilience against the server dying comes from run-server-loop.bat itself
' immediately relaunching node whenever it exits, rather than from this
' script being re-triggered.
'
' The project directory is derived from this script's own location
' (<project>\tools\autostart\ensure-server.vbs), so the repo can be moved or
' cloned anywhere without editing these files.
Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectDir = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))

' True when an HTTP GET to the hub succeeds. Uses WinHTTP in-process rather
' than shelling out to PowerShell/netstat: no console flash, no dependence on
' the caller's PATH or code page, and it proves the server is actually
' serving, not merely that something holds the port.
Function ServerUp()
  On Error Resume Next
  Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
  http.SetTimeouts 1000, 1000, 2000, 2000
  http.Open "GET", "http://localhost:3210/", False
  http.Send
  ServerUp = (Err.Number = 0)
  On Error GoTo 0
End Function

If Not ServerUp() Then
  objShell.Run "cmd /c """ & projectDir & "\tools\autostart\run-server-loop.bat""", 0, False
End If
