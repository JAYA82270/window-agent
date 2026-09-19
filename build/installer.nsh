!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WordFunc.nsh"
!insertmacro GetFileVersion
!insertmacro VersionCompare

!ifndef BUILD_UNINSTALLER

Var EXISTING_EXE
Var EXISTING_VERSION
Var AGENT_RUNNING
Var INSTALL_LOG

!macro WriteInstallLog LINE
  ClearErrors
  CreateDirectory "$APPDATA\shyldone-agent"
  FileOpen $9 "$INSTALL_LOG" a
  ${IfThen} ${Errors} ${|} FileOpen $9 "$INSTALL_LOG" w ${|}
  FileWrite $9 "${LINE}$\r$\n"
  FileClose $9
!macroend

Function WriteInstallLogLine
  Exch $0
  Push $9
  ClearErrors
  CreateDirectory "$APPDATA\shyldone-agent"
  FileOpen $9 "$INSTALL_LOG" a
  ${IfThen} ${Errors} ${|} FileOpen $9 "$INSTALL_LOG" w ${|}
  FileWrite $9 "$0$\r$\n"
  FileClose $9
  Pop $9
  Pop $0
FunctionEnd

Function DetectExistingInstall
  StrCpy $EXISTING_EXE ""
  StrCpy $EXISTING_VERSION ""
  StrCpy $R5 ""

  ReadRegStr $R6 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  StrCmp $R6 "" +2 0
    StrCpy $R5 "$R6\${PRODUCT_FILENAME}.exe"

  StrCmp $R5 "" 0 found
    StrCpy $R5 "$LOCALAPPDATA\Programs\${PRODUCT_NAME}\${PRODUCT_FILENAME}.exe"
  IfFileExists $R5 found 0
    StrCpy $R5 "$LOCALAPPDATA\Programs\GetGRC\GetGRC.exe"
  IfFileExists $R5 found 0
    StrCpy $R5 "$LOCALAPPDATA\Programs\shyldone\shyldone.exe"
  IfFileExists $R5 found not_found

  found:
    StrCpy $EXISTING_EXE $R5
    ${GetFileVersion} $R5 $EXISTING_VERSION
    ${IfThen} $EXISTING_VERSION == "" ${|} StrCpy $EXISTING_VERSION "unknown" ${|}
    Push "Detected existing agent at $EXISTING_EXE (version $EXISTING_VERSION)"
    Call WriteInstallLogLine
    StrCpy $R0 "1"
    Return

  not_found:
    Push "No existing agent installation detected"
    Call WriteInstallLogLine
    StrCpy $R0 "0"
FunctionEnd

Function IsAgentRunning
  StrCpy $AGENT_RUNNING "0"
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ${PRODUCT_FILENAME}.exe" /NH'
  Pop $0
  Pop $1
  ${If} $0 == 0
    ${If} $1 != ""
      StrCpy $AGENT_RUNNING "1"
      Return
    ${EndIf}
  ${EndIf}

  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq GetGRC.exe" /NH'
  Pop $0
  Pop $1
  ${If} $0 == 0
    ${If} $1 != ""
      StrCpy $AGENT_RUNNING "1"
      Return
    ${EndIf}
  ${EndIf}

  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq shyldone.exe" /NH'
  Pop $0
  Pop $1
  ${If} $0 == 0
    ${If} $1 != ""
      StrCpy $AGENT_RUNNING "1"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function StopAgentProcesses
  Push "Stopping existing agent processes"
  Call WriteInstallLogLine
  nsExec::Exec 'taskkill /IM ${PRODUCT_FILENAME}.exe /F /T'
  nsExec::Exec 'taskkill /IM GetGRC.exe /F /T'
  nsExec::Exec 'taskkill /IM shyldone.exe /F /T'
  Sleep 2000
FunctionEnd

Function BackupAgentConfig
  IfFileExists "$APPDATA\shyldone-agent\shyldone-agent.json" 0 +2
    CopyFiles /SILENT "$APPDATA\shyldone-agent\shyldone-agent.json" "$APPDATA\shyldone-agent\shyldone-agent.json.bak"
  Push "Backed up agent configuration"
  Call WriteInstallLogLine
FunctionEnd

Function StartExistingAgent
  Push "Starting existing agent without reinstalling"
  Call WriteInstallLogLine
  Exec '"$EXISTING_EXE" --background'
  MessageBox MB_OK|MB_ICONINFORMATION "GetGRC agent started successfully.$\n$\nExisting installation was left unchanged."
  Abort
FunctionEnd

Function PromptReplaceAgent
  StrCpy $R7 "Stopped"
  ${If} $AGENT_RUNNING == "1"
    StrCpy $R7 "Running"
  ${EndIf}

  StrCpy $R8 "unknown"
  ${If} $EXISTING_VERSION != ""
    StrCpy $R8 $EXISTING_VERSION
  ${EndIf}

  MessageBox MB_YESNO|MB_ICONQUESTION "Agent Already Installed$\n$\nAn agent is already installed on this device.$\n$\nCurrent Version: $R8$\nNew Version: ${VERSION}$\nStatus: $R7$\n$\nDo you want to replace the existing agent?" IDYES replace_confirmed
  Push "Installation cancelled by user"
  Call WriteInstallLogLine
  Abort

  replace_confirmed:
    Call BackupAgentConfig
    Call StopAgentProcesses
    Push "User confirmed agent replacement"
    Call WriteInstallLogLine
FunctionEnd

Function HandleSameVersionStopped
  MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "Same version already installed but not running.$\n$\nCurrent Version: ${VERSION}$\nStatus: Stopped$\n$\nStart the existing agent without reinstalling?" IDYES hsvs_start IDNO hsvs_more
  Goto hsvs_abort
  hsvs_start:
    Call StartExistingAgent
    Return
  hsvs_more:
  MessageBox MB_YESNO|MB_ICONQUESTION "Reinstall the agent anyway?" IDYES hsvs_replace IDNO hsvs_abort
  Goto hsvs_abort
  hsvs_replace:
    Call PromptReplaceAgent
    Return
  hsvs_abort:
    Abort
FunctionEnd

Function HandleSameVersionRunning
  MessageBox MB_YESNO|MB_ICONQUESTION "Same version already installed.$\n$\nCurrent Version: ${VERSION}$\nStatus: Running$\n$\nReinstall anyway?" IDYES hsvr_replace IDNO hsvr_abort
  hsvr_replace:
    Call PromptReplaceAgent
    Return
  hsvr_abort:
    Abort
FunctionEnd

Function HandleDowngradePrompt
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "A newer agent is already installed.$\n$\nInstalled Version: $EXISTING_VERSION$\nInstaller Version: ${VERSION}$\n$\nDowngrading is not recommended.$\n$\nReplace anyway?" IDYES hdp_confirm IDNO hdp_abort
  hdp_confirm:
    Call PromptReplaceAgent
    Return
  hdp_abort:
    Abort
FunctionEnd

Function HandleExistingInstall
  ${If} $EXISTING_VERSION == "unknown"
    Call PromptReplaceAgent
    Return
  ${EndIf}

  ${VersionCompare} $EXISTING_VERSION "${VERSION}" $R9

  ; R9: 0=equal, 1=existing newer, 2=existing older
  ${If} $R9 == 0
    ${If} $AGENT_RUNNING == "0"
      Call HandleSameVersionStopped
    ${Else}
      Call HandleSameVersionRunning
    ${EndIf}
    Return
  ${EndIf}

  ${If} $R9 == 1
    Call HandleDowngradePrompt
    Return
  ${EndIf}

  Call PromptReplaceAgent
FunctionEnd

Function RunInstallPrecheck
  StrCpy $INSTALL_LOG "$APPDATA\shyldone-agent\install.log"
  Push "=== GetGRC installer pre-check (${VERSION}) ==="
  Call WriteInstallLogLine

  Call DetectExistingInstall
  ${If} $R0 == "0"
    Return
  ${EndIf}

  Call IsAgentRunning
  Call HandleExistingInstall
FunctionEnd

Function VerifyInstallation
  StrCpy $INSTALL_LOG "$APPDATA\shyldone-agent\install.log"
  IfFileExists "$INSTDIR\${PRODUCT_FILENAME}.exe" verify_ok verify_failed

  verify_failed:
    Push "Installation verification failed — executable missing"
    Call WriteInstallLogLine
    MessageBox MB_OK|MB_ICONSTOP "Installation failed.$\n$\nThe agent executable was not installed correctly.$\n$\nLog: $INSTALL_LOG"
    Return

  verify_ok:
    ${GetFileVersion} "$INSTDIR\${PRODUCT_FILENAME}.exe" $R0
    Push "Installed version verified: $R0"
    Call WriteInstallLogLine
    Push "Installation path: $INSTDIR"
    Call WriteInstallLogLine
FunctionEnd

!macro customInit
  StrCpy $INSTALL_LOG "$APPDATA\shyldone-agent\install.log"
  !insertmacro WriteInstallLog "Installer initialized"
  Call RunInstallPrecheck
!macroend

!macro customInstall
  Call VerifyInstallation
  Push "Agent files installed successfully"
  Call WriteInstallLogLine
!macroend

!macro customRun
  Push "Starting GetGRC agent after installation"
  Call WriteInstallLogLine
  Exec '"$INSTDIR\${PRODUCT_FILENAME}.exe" --background --install-verify'
  Push "=== Installation completed successfully ==="
  Call WriteInstallLogLine
!macroend

!endif
