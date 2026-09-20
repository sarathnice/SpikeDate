@echo off
cd /d "%~dp0"
call npm run qa:stage
echo.
echo Testing finished. Review the report opened in your browser and the result above.
pause
