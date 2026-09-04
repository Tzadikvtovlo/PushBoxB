@echo off
chcp 65001 >nul
title PushBox - יצירת קובצי ZIP לגרסאות הבטא (Beta)
echo =========================================================
echo       PushBox - יצירת קובצי ZIP לגרסאות הבטא (Beta)
echo =========================================================
echo.

set SCRIPT_DIR=%~dp0
set DEST_DIR=%USERPROFILE%\Downloads
if not exist "%DEST_DIR%" (
    mkdir "%DEST_DIR%" 2>nul
)

set BETA_492_DIR=%SCRIPT_DIR%beta
set BETA_465_DIR=%SCRIPT_DIR%beta-4.65

echo תיקיית יעד: %DEST_DIR%
echo.

REM --- יצירת גרסה 4.92 בטא ---
echo [1/2] יוצר ZIP עבור בטא 4.92 (פיצ'רים חדשים: שליחת SMS, לא-נקרא, תזכורות)...
if exist "%BETA_492_DIR%" (
    if exist "%DEST_DIR%\PushBox-v4.92-Beta.zip" del /f /q "%DEST_DIR%\PushBox-v4.92-Beta.zip" 2>nul
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '%BETA_492_DIR%\*' -DestinationPath '%DEST_DIR%\PushBox-v4.92-Beta.zip' -Force"
    if exist "%DEST_DIR%\PushBox-v4.92-Beta.zip" (
        echo  -> נוצר בהצלחה: %DEST_DIR%\PushBox-v4.92-Beta.zip
    ) else (
        echo  [שגיאה] יצירת קובץ 4.92 נכשלה.
    )
) else (
    echo [אזהרה] תיקיית beta לא נמצאה בנתיב %BETA_492_DIR%.
)

echo.

REM --- יצירת גרסה 4.65 בטא ---
echo [2/2] יוצר ZIP עבור בטא 4.65 (שיפורי תשתית, מטמון ותיקוני באגים על בסיס 4.6)...
if exist "%BETA_465_DIR%" (
    if exist "%DEST_DIR%\PushBox-v4.65-Beta.zip" del /f /q "%DEST_DIR%\PushBox-v4.65-Beta.zip" 2>nul
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '%BETA_465_DIR%\*' -DestinationPath '%DEST_DIR%\PushBox-v4.65-Beta.zip' -Force"
    if exist "%DEST_DIR%\PushBox-v4.65-Beta.zip" (
        echo  -> נוצר בהצלחה: %DEST_DIR%\PushBox-v4.65-Beta.zip
    ) else (
        echo  [שגיאה] יצירת קובץ 4.65 נכשלה.
    )
) else (
    echo [אזהרה] תיקיית beta-4.65 לא נמצאה בנתיב %BETA_465_DIR%.
)

echo.
echo =========================================================
echo  [סיום] בדוק את קובצי ה-ZIP בתיקיית ההורדות:
echo   1. %DEST_DIR%\PushBox-v4.92-Beta.zip
echo   2. %DEST_DIR%\PushBox-v4.65-Beta.zip
echo =========================================================
echo.
pause
