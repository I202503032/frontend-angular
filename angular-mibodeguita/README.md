# Frontend Angular de MiBodeguita

## Requisitos
- Node.js compatible con Angular 20 y npm.
- Backend Spring Boot activo en `http://localhost:8080`.
- MySQL con la base de datos `mibodegaapp` y un usuario cuya contraseña esté almacenada con BCrypt.

## Ejecutar
1. Abre una terminal en esta carpeta.
2. Ejecuta `npm install`.
3. Ejecuta `npm start`.
4. Abre `http://localhost:4200`.

La pantalla consume `POST /api/auth/login` y `GET/POST/PUT/DELETE /api/productos`. La sesión de interfaz se conserva en `sessionStorage`; este prototipo académico no implementa todavía tokens JWT ni autorización de API por roles. Antes de producción se debe proteger la API y configurar autenticación/autorización en Spring Security.
