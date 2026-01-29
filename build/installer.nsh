; Custom NSIS installer script for MPC-DiscordRPC
; Desktop shortcut prompt and uninstall cleanup

!macro customInstall
  ; Ask user about desktop shortcut
  MessageBox MB_YESNO|MB_ICONQUESTION "Create a desktop shortcut?" IDNO skipDesktop
    CreateShortCut "$DESKTOP\MPC-DiscordRPC.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  skipDesktop:
  
  ; Ask user about Windows startup
  MessageBox MB_YESNO|MB_ICONQUESTION "Run MPC-DiscordRPC on Windows startup?" IDNO skipStartup
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MPC-DiscordRPC" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  skipStartup:
!macroend

!macro customUnInstall
  ; Remove from startup
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MPC-DiscordRPC"
  ; Remove desktop shortcut if exists
  Delete "$DESKTOP\MPC-DiscordRPC.lnk"
!macroend
