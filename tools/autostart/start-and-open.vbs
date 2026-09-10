' Logon launcher: makes sure the server is running (via the self-restarting
' loop in run-server-loop.bat, which keeps relaunching node if it ever
' exits — this is what gives resilience against the server dying, since
' Task Scheduler isn't available in this environment to re-check
' periodically), waits for it to actually accept connections, then opens it
' in the default browser.
Set objShell = CreateObject("WScript.Shell")
projectDir = "C:\Users\Natalie\Desktop\csie_prep_package"

Function PortOpen()
  Set res = objShell.Exec("powershell -NoProfile -Command ""(Get-NetTCPConnection -LocalPort 3210 -State Listen -ErrorAction SilentlyContinue) -ne $null""")
  Do While res.Status = 0
    WScript.Sleep 100
  Loop
  PortOpen = (Trim(res.StdOut.ReadAll()) = "True")
End Function

If Not PortOpen() Then
  objShell.Run "cmd /c """ & projectDir & "\tools\autostart\run-server-loop.bat""", 0, False
End If

ready = False
For i = 1 To 30
  If PortOpen() Then
    ready = True
    Exit For
  End If
  WScript.Sleep 1000
Next

objShell.Run "http://localhost:3210", 1, False
