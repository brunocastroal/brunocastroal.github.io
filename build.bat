@echo off
chcp 65001 > nul
echo ===================================================
echo   Compilando Site Acadêmico para GitHub Pages...
echo ===================================================
echo.
node build.js
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo   [OK] Site compilado com sucesso!
    echo   Todos os arquivos estaticos estao prontos.
    echo ===================================================
) else (
    echo.
    echo [ERRO] Houve um problema ao compilar o site.
)
echo.
pause
