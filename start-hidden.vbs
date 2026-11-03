' start-hidden.vbs
' Menjalankan Odoo Print Proxy di background secara tersembunyi tanpa jendela hitam CMD
' Cocok untuk komputer kasir agar tidak sengaja tertutup oleh kasir.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = currentDir
WshShell.Run "cmd.exe /c node server.js", 0, False
