@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0.."
set "PIDFILE=%~dp0.server-8777.pid"
set "PORT=8777"
set "URL=http://127.0.0.1:%PORT%/world-manager/"

cd /d "%ROOT%"

REM 이미 켜져 있으면 브라우저만 연다
if exist "%PIDFILE%" (
  set /p OLDPID=<"%PIDFILE%"
  tasklist /FI "PID eq %OLDPID%" 2>nul | find "%OLDPID%" >nul
  if not errorlevel 1 (
    echo 서버가 이미 실행 중입니다. 브라우저만 엽니다.
    start "" "%URL%"
    exit /b 0
  )
)

REM 백그라운드로 서버 시작 (이 창을 닫아도 유지)
powershell -NoProfile -Command ^
  "$p = Start-Process -FilePath 'python' -ArgumentList '-u','scripts/world-manager-server.py','%PORT%' -WorkingDirectory '%ROOT%' -WindowStyle Hidden -PassThru; Set-Content -Path '%PIDFILE%' -Value $p.Id -Encoding ascii"

timeout /t 1 /nobreak >nul
start "" "%URL%"

echo.
echo  서버를 백그라운드에서 켰습니다. (포트 %PORT%)
echo  이 창은 닫아도 됩니다.
echo  끌 때는 「종료하기.bat」을 실행하세요.
echo.
timeout /t 3 /nobreak >nul
exit /b 0
