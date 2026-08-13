@echo off
chcp 65001 >nul
setlocal
set "PIDFILE=%~dp0.server-8777.pid"
set "PORT=8777"

echo.
echo  World Manager 서버를 종료합니다...

REM PID 파일로 종료
if exist "%PIDFILE%" (
  set /p PID=<"%PIDFILE%"
  if defined PID (
    taskkill /F /PID %PID% >nul 2>&1
  )
  del /F /Q "%PIDFILE%" >nul 2>&1
)

REM 포트에 남은 프로세스도 정리
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  taskkill /F /PID %%P >nul 2>&1
)

echo  종료했습니다.
echo.
timeout /t 2 /nobreak >nul
exit /b 0
