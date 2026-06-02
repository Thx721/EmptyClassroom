@echo off
chcp 65001 >nul
REM ============================================
REM  EmptyClassroom Launcher
REM ============================================

set JW_USERNAME=your_student_id
set JW_PASSWORD=your_password
set CONFIG_PATH=config

echo Starting EmptyClassroom...
echo URL: http://localhost:8080
echo.

ec.exe

pause
