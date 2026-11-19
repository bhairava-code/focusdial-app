Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define APPNAME "FocusDial"
!define APPID "com.pronoy.focusdial"
!define VERSION "1.0.0"
!define PUBLISHER "Pronoy Kumar Das"
!define SRC "/home/claude/focusdial-app/dist/win-unpacked"
!define ICO "/home/claude/focusdial-app/build/icon.ico"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPID}"
!addplugindir /x86-unicode "/root/.cache/electron-builder/nsis-resources-3.4.1/nsis-resources-3.4.1-2jx2y/plugins/x86-unicode"

Name "${APPNAME}"
OutFile "/home/claude/focusdial-app/dist/FocusDial-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\FocusDial"
InstallDirRegKey HKCU "Software\${APPNAME}" "InstallDir"
RequestExecutionLevel user
BrandingText "FocusDial ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "FocusDial"
VIAddVersionKey "FileDescription" "FocusDial Setup"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "LegalCopyright" "© 2026 ${PUBLISHER}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"

!include "MUI2.nsh"
!include "FileFunc.nsh"
!define MUI_ICON "${ICO}"
!define MUI_UNICON "${ICO}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "FocusDial"
!define MUI_WELCOMEPAGE_TEXT "Flip clock, Pomodoro timer, tasks and habits — floating on your desktop.$\r$\n$\r$\nClick Next to continue."
!define MUI_FINISHPAGE_RUN "$INSTDIR\FocusDial.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch FocusDial"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onVerifyInstDir
  ; refuse drive roots and system folders
  StrLen $0 $INSTDIR
  IntCmp $0 3 0 0 +2
    Abort
FunctionEnd

Function .onInit
  nsExec::Exec 'taskkill /IM FocusDial.exe /F'
  Pop $0
FunctionEnd

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SRC}/*"
  WriteUninstaller "$INSTDIR\Uninstall FocusDial.exe"

  CreateShortcut "$SMPROGRAMS\FocusDial.lnk" "$INSTDIR\FocusDial.exe" "" "$INSTDIR\FocusDial.exe" 0
  WinShell::SetLnkAUMI "$SMPROGRAMS\FocusDial.lnk" "${APPID}"
  CreateShortcut "$DESKTOP\FocusDial.lnk" "$INSTDIR\FocusDial.exe" "" "$INSTDIR\FocusDial.exe" 0
  WinShell::SetLnkAUMI "$DESKTOP\FocusDial.lnk" "${APPID}"

  WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "FocusDial"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\FocusDial.exe"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Uninstall FocusDial.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM FocusDial.exe /F'
  Pop $0
  Delete "$SMPROGRAMS\FocusDial.lnk"
  Delete "$DESKTOP\FocusDial.lnk"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APPID}"
  ; Remove ONLY the files this installer wrote (never RMDir /r a folder the user may have chosen).
  !include "/home/claude/focusdial-app/installer/uninstall-files.nsh"
  Delete "$INSTDIR\Uninstall FocusDial.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\${APPNAME}"
SectionEnd
