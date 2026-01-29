@echo off
echo Git kurulumu basliyor...
git init
git add .
git commit -m "Not Defterim Ilk Kurulum"
git branch -M main
git remote remove origin
git remote add origin https://github.com/recepatac-afk/not-defterim.git
echo.
echo Kurulum Tamamlandi!
echo Simdi terminale sunu yazin: git push -u origin main
pause
