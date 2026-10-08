@echo off
chcp 65001 > nul
set "PATH=%PATH%;C:\Users\Bruno Castro\AppData\Local\GitHubDesktop\app-3.6.6\resources\app\git\cmd"
echo ===================================================
echo   Publicando Site no GitHub Pages...
echo ===================================================
echo.
echo 1. Verificando compilacao estatica...
node build.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao compilar o site.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 2. Registrando alteracoes no Git...
git add .
git commit -m "Atualizacao do site academico" 2>nul

echo.
echo 3. Enviando arquivos para o GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo   [OK] Site enviado com sucesso para o GitHub!
    echo   Acesse em instantes: https://brunocastroal.github.io
    echo ===================================================
) else (
    echo.
    echo ===================================================
    echo [AVISO] O envio nao foi concluido.
    echo Motivos comuns:
    echo 1. O repositorio 'brunocastroal.github.io' ainda nao foi criado no GitHub:
    echo    Crie em: https://github.com/new com o nome brunocastroal.github.io
    echo 2. Voce precisa fazer login na janela que o GitHub abrir.
    echo ===================================================
)
echo.
pause
