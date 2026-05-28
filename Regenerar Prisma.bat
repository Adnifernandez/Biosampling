@echo off
cd /d "C:\Users\dss_419\Desktop\Apps\Biosampling\biosampling-app"
echo Aplicando schema a la base de datos...
"C:\OSGeo4W\apps\node\node.exe" node_modules/.bin/prisma db push
echo.
echo Regenerando cliente Prisma...
"C:\OSGeo4W\apps\node\node.exe" node_modules/.bin/prisma generate
echo.
echo Limpiando cache de Next.js...
if exist ".next" rmdir /s /q ".next"
echo.
echo Listo! Ahora puedes iniciar el servidor con "Iniciar BioSampling.bat"
pause
