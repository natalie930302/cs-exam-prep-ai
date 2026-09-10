' Idempotent watchdog: starts the CSIE Prep Hub server (via the
' self-restarting loop in run-server-loop.bat) if it isn't already
' listening on port 3210. Safe to run repeatedly — does nothing but exit if
' the server is already up, so it never spawns a second instance and never
' opens a browser window on its own. Task Scheduler isn't available in this
' environment to re-run this periodically, so the resilience against the
' server dying comes from run-server-loop.bat itself immediately relaunching
' node whenever it exits, rather than from this script being re-triggered.
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
