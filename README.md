# 📚 Backend - Revista Mundo FESC

API REST para la gestión de envíos, autores y evaluación de artículos de la **Revista Mundo FESC**.
Desarrollado con **Node.js**, **Express** y **MySQL**.

---

## 🚀 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en tu equipo:

* **Node.js** (versión 18 o superior)
* **XAMPP** (con los servicios de Apache y MySQL activos)
* **Git**
* **Postman** (opcional, para pruebas de endpoints)

---

## 🛠️ Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO_GIT>
cd revista-mundo-fesc-backend
```

---

### 2. Instalar dependencias

```bash
npm install
```

---

### 3. Configurar la Base de Datos

1. Abre el panel de control de **XAMPP**
2. Inicia el servicio de **MySQL**
3. Ingresa a **phpMyAdmin** (o usa DBeaver)
4. Crea una base de datos llamada:

```sql
revista_mundo_fesc
```

5. En phpMyAdmin, selecciona `revista_mundo_fesc` e importa `database/schema.sql`.
6. Para cargar registros locales de revisión, importa opcionalmente `database/seed.sql`.

> **Desarrollo únicamente:** `database/schema.sql` elimina y vuelve a crear las tablas. No lo ejecutes sobre una base con información que quieras conservar ni en producción. Detén el backend antes de importarlo.

El esquema crea la estructura y una identidad local sin contraseña (`maria.garcia@prueba.com`) necesaria para relacionar los envíos del perfil de autor. No sirve para iniciar sesión. `seed.sql` es opcional, contiene registros para revisar los distintos estados editoriales y se puede importar más de una vez. Sus cuentas tampoco tienen contraseña. Para una base existente, aplica las migraciones de `database/migrations/` en orden; incluyen `submission_reviews` y la bitácora `submission_audit_logs`.

---

### 4. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto y agrega:

```env
PORT=4000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=revista_mundo_fesc
DB_PORT=3306

JWT_SECRET=fesc_secret_key_2026_revista_mundo
JWT_EXPIRES_IN=24h
DEV_AUTH_BYPASS=false
```

Para usar el frontend con los perfiles locales, configura `DEV_AUTH_BYPASS=true` únicamente en tu `.env` local y reinicia el backend. El rol seleccionado se envía como `X-Dev-Role`; el backend lo acepta solo fuera de producción y si la variable está habilitada. Las acciones de autor usan la identidad local incluida en el esquema. Estas identidades no permiten iniciar sesión.

No uses este modo en producción. Con un token JWT real, el backend ignora el rol mock y valida el token normalmente.

---

## 💻 Uso del Servidor

Para iniciar el servidor en modo desarrollo con recarga automática:

```bash
npm run dev
```

El servidor se ejecutará en:

```
http://localhost:4000
```

---

## 📌 Módulos y Endpoints Disponibles

### 🟢 Health Check

| Método | Endpoint    | Descripción                                  |
| ------ | ----------- | -------------------------------------------- |
| GET    | /api/health | Verifica estado de la API y conexión a MySQL |

---

### 🔐 Autenticación

| Método | Endpoint           | Descripción                               |
| ------ | ------------------ | ----------------------------------------- |
| POST   | /api/auth/register | Registro de usuarios                      |
| POST   | /api/auth/login    | Inicio de sesión y obtención de Token JWT |

---

### 📄 Envíos (Submissions)

| Método | Endpoint                        | Descripción                                         |
| ------ | ------------------------------- | --------------------------------------------------- |
| POST   | /api/submissions                | Crear borrador de artículo (requiere JWT)           |
| GET    | /api/submissions                | Listar envíos con autor, metadatos, estado y editor asignado (admin/editor); acepta `page`, `limit` (máx. 100), `sortBy` y `order` (`asc`/`desc`) |
| GET    | /api/submissions/my-submissions | Listar borradores del autor logueado (requiere JWT) |
| DELETE | /api/submissions/:id            | Eliminar un borrador propio (requiere JWT)          |
| PATCH  | /api/submissions/:id/status     | Actualizar el estado editorial (admin/editor; JSON: `{"estado":"en_revision"}`) |
| PATCH  | /api/submissions/:id/assign-editor | Asignar o desasignar editor (admin/editor; JSON: `{"editor_id":"<id>"}` o `null`) |
| GET    | /api/submissions/reviewers      | Listar revisores disponibles (admin/editor) |
| PATCH  | /api/submissions/:id/assign-reviewer | Asignar revisor y fecha límite (admin/editor; JSON: `{"reviewer_id":"<id>","fecha_limite":"AAAA-MM-DD"}`) |
| PATCH  | /api/submissions/:id/editorial  | Actualizar estado y/o editor en una misma solicitud (admin/editor) |
| GET    | /api/submissions/:id/audit-logs | Consultar la bitácora cronológica del envío (admin/editor) |

La respuesta de `GET /api/submissions` incluye `submissions` y `pagination` (`page`, `limit`, `total`, `totalPages`). Cuando se omiten `page` y `limit`, conserva la lista completa para los consumidores existentes.

Las rutas editoriales responden con JSON y devuelven el envío actualizado. Un estado no válido o un editor inexistente produce `400`; un envío inexistente produce `404`.

---

### 👥 Autores / Coautores

| Método | Endpoint                              | Descripción                  |
| ------ | ------------------------------------- | ---------------------------- |
| POST   | /api/authors                          | Asignar coautor a un envío   |
| GET    | /api/authors/submission/:submissionId | Listar coautores de un envío |
| DELETE | /api/authors/:id                      | Eliminar coautor             |

---

## 🔑 Autenticación con JWT

Los endpoints protegidos requieren incluir el token en los headers:

```http
Authorization: Bearer TU_TOKEN
```

---

## 📂 Estructura del Proyecto (Ejemplo)

```
src/
│── controllers/
│── routes/
│── models/
│── middlewares/
│── config/
│── app.js
│── server.js
```

---

## 🧪 Pruebas

Puedes utilizar herramientas como **Postman** o **Insomnia** para probar los endpoints de la API.

---

## ⚠️ Consideraciones

* Asegúrate de que MySQL esté en ejecución antes de iniciar el servidor
* Verifica que las credenciales en `.env` coincidan con tu configuración local
* No subas el archivo `.env` al repositorio (agrégalo a `.gitignore`)

---

## 👨‍💻 Autor

Proyecto desarrollado para la **Revista Mundo FESC**
