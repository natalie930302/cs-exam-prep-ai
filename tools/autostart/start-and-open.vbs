' Logon launcher: makes sure the server is running (via the self-restarting
' loop in run-server-loop.bat, which keeps relaunching node if it ever
' exits - this is what gives resilience against the server dying, since
' Task Scheduler isn't available in this environment to re-check
' periodically), waits for it to actually answer HTTP, then opens it in the
' default browser.
'
' The project directory is derived from this script's own location
' (<project>\tools\autostart\start-and-open.vbs), so the repo can be moved or
' cloned anywhere without editing these files. To install at logon, run
' install-startup.ps1 once; it drops a shortcut to this script into the
' user's Startup folder.
Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectDir = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))

' True when an HTTP GET to the hub succeeds (see ensure-server.vbs).
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

' Give node up to ~30s to come up (first boot after logon can be slow).
For i = 1 To 30
  If ServerUp() Then Exit For
  WScript.Sleep 1000
Next

objShell.Run "http://localhost:3210", 1, False
