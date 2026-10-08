@echo off
chcp 65001 > nul
echo ===================================================
echo   Compilando e Iniciando Pré-visualização Local...
echo ===================================================
echo.
node build.js
if %ERRORLEVEL% EQU 0 (
    node server.js
) else (
    echo [ERRO] Falha ao compilar o site.
    pause
)
