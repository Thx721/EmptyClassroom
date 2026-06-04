@echo off
REM ============================================================
REM 空教室数据本地抓取 → 自动 push 到 GitHub → 触发部署
REM
REM 用法:
REM   fetch-local.bat 学号 密码
REM
REM 或者设置永久环境变量后直接双击运行:
REM   setx JW_USERNAME "你的学号"
REM   setx JW_PASSWORD "你的密码"
REM ============================================================

cd /d "%~dp0.."

REM 优先用命令行参数，其次用环境变量
if not "%~2"=="" (
    set JW_USERNAME=%~1
    set JW_PASSWORD=%~2
    echo Using credentials from command line
) else if not "%JW_USERNAME%"=="" (
    echo Using credentials from environment variables
) else (
    echo [ERROR] 请设置凭据：
    echo   方式1: fetch-local.bat 学号 密码
    echo   方式2: setx JW_USERNAME "学号" ^& setx JW_PASSWORD "密码" ^(重启终端后生效^)
    exit /b 1
)

echo.
echo === 空教室数据抓取 ===
echo.
node script/fetch.mjs
echo.
echo === 完成 ===
pause
