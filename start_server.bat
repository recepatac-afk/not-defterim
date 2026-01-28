@echo off
echo Sunucu baslatiliyor...
echo Lutfen tarayicinizdan su adrese gidin: http://localhost:8080
echo Sunucuyu kapatmak icin bu pencereyi kapatin.
python -m http.server 8080
pause
