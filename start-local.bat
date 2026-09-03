@echo off
echo =======================================
echo   om_music_bot - Local Launcher
echo =======================================

echo [1/2] Starting Lavalink server...
start "Lavalink" cmd /k "cd /d "%~dp0lavalink" && java -jar Lavalink.jar"

echo Waiting 15 seconds for Lavalink to boot...
timeout /t 15 /nobreak

echo [2/2] Starting Discord bot...
start "om_music_bot Bot" cmd /k "cd /d "%~dp0" && node devrock.js"

echo.
echo Both processes are running in separate windows.
echo Close those windows to stop them.
pause
