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
6. Aplica `database/migrations/009_seed_editorial_email_templates.sql` para cargar las plantillas predeterminadas. Para cargar además registros locales de revisión, importa opcionalmente `database/seed.sql`.

> **Desarrollo únicamente:** `database/schema.sql` elimina y vuelve a crear las tablas. No lo ejecutes sobre una base con información que quieras conservar ni en producción. Detén el backend antes de importarlo.

El esquema y `seed.sql` incluyen cuentas de prueba para desarrollo local. Se pueden usar para iniciar sesión con las contraseñas `admin123`, `editor123`, `revisor123` y `usuario123`, respectivamente. El correo de autor se conserva en el seed; los otros correos son `admin@fesc.edu.co`, `editor@fesc.edu.co` y `reviewer@fesc.edu.co`. No uses estas credenciales en producción. `seed.sql` también incluye las plantillas predeterminadas y se puede importar más de una vez. Para actualizar una base local existente, aplica `database/migrations/011_enable_local_test_account_logins.sql` o vuelve a importar `database/seed.sql`. Para una base existente, aplica las demás migraciones de `database/migrations/` en orden; incluyen `submission_reviews`, las bitácoras y las plantillas de correo. El backend también crea `audit_logs` al iniciar si la tabla aún no existe.

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

SMTP_HOST=smtp.example.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario_smtp
SMTP_PASS=contrasena_smtp
SMTP_FROM="Revista Mundo FESC <no-reply@example.org>"
FRONTEND_URL=http://localhost:5173
```

Para usar el frontend con los perfiles locales, configura `DEV_AUTH_BYPASS=true` únicamente en tu `.env` local y reinicia el backend. El rol seleccionado se envía como `X-Dev-Role`; el backend lo acepta solo fuera de producción y si la variable está habilitada.

No uses este modo en producción. Con un token JWT real, el backend ignora el rol mock y valida el token normalmente.

El envío de correo usa Nodemailer. Configura las variables `SMTP_*` con los datos del proveedor; `SMTP_USER` y `SMTP_PASS` son opcionales solo si el servidor permite relay sin autenticación. Para bases existentes, aplica también `database/migrations/009_seed_editorial_email_templates.sql`. En una instalación local nueva, `database/seed.sql` agrega las plantillas predeterminadas. Las plantillas se pueden personalizar desde la gestión de plantillas de correo.

`FRONTEND_URL` debe apuntar al origen del frontend para construir los enlaces de recuperación. Aplica `database/migrations/012_create_password_reset_tokens.sql` en todas las instalaciones, también después de importar `database/schema.sql`; los tokens se almacenan hasheados, vencen en una hora y solo pueden usarse una vez.

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
| GET    | /api/submissions/my-reviews | Listar las asignaciones del revisor autenticado, con fecha límite y estado (rol reviewer) |
| GET    | /api/submissions/review-history | Consultar los dictámenes enviados por el revisor autenticado (rol reviewer) |
| GET    | /api/submissions/:id/review | Consultar el dictamen propio de un envío asignado (rol reviewer) |
| PUT    | /api/submissions/:id/review | Registrar o actualizar el dictamen y, opcionalmente, un archivo PDF/DOC/DOCX de anotaciones (rol reviewer; multipart, máximo 10 MB) |
| GET    | /api/submissions/:id/reviewers/:reviewerId/history/:historyId/attachment | Descargar/ver el archivo de anotaciones (solo revisor propietario o equipo editorial) |
| DELETE | /api/submissions/:id            | Eliminar un borrador propio (requiere JWT)          |
| PATCH  | /api/submissions/:id/status     | Actualizar el estado editorial (admin/editor; JSON: `{"estado":"en_revision"}`) |
| PATCH  | /api/submissions/:id/assign-editor | Asignar o desasignar editor (admin/editor; JSON: `{"editor_id":"<id>"}` o `null`) |
| GET    | /api/submissions/reviewers      | Listar revisores disponibles (admin/editor) |
| PATCH  | /api/submissions/:id/assign-reviewer | Asignar revisor y fecha límite (admin/editor; JSON: `{"reviewer_id":"<id>","fecha_limite":"AAAA-MM-DD"}`) |
| PATCH  | /api/submissions/:id/editorial  | Actualizar estado y/o editor en una misma solicitud (admin/editor) |
| GET    | /api/submissions/:id/audit-logs | Consultar la bitácora cronológica del envío (admin/editor) |

La respuesta de `GET /api/submissions` incluye `submissions` y `pagination` (`page`, `limit`, `total`, `totalPages`). Cuando se omiten `page` y `limit`, conserva la lista completa para los consumidores existentes.

Las rutas editoriales responden con JSON y devuelven el envío actualizado. Un estado no válido o un editor inexistente produce `400`; un envío inexistente produce `404`.

El dictamen requiere una recomendación (`aceptar`, `revisiones_menores`, `revisiones_mayores` o `rechazar`), comentarios no vacíos para el autor y al menos un campo estructurado para el editor (`fortalezas`, `debilidades`, `metodologia` o `comentario_confidencial`). Los comentarios confidenciales solo son visibles para el equipo editorial y el revisor que los escribió; no se exponen a autores ni a otros revisores.

Cada envío de dictamen queda como un registro histórico independiente, incluso si luego se actualiza o se retira la asignación. Los archivos de anotaciones se guardan fuera del directorio estático `uploads/` y no se mezclan con los adjuntos visibles al autor. Se admiten `.pdf`, `.doc` y `.docx` con máximo de 10 MB; los PDF se pueden visualizar en el navegador y Word se descarga. El acceso está limitado al revisor propietario del dictamen y al equipo editorial.

Para bases existentes, aplica `database/migrations/013_add_reviewer_decisions.sql`, `database/migrations/014_add_reviewer_annotation_files.sql`, `database/migrations/015_create_help_contents.sql`, `database/migrations/016_create_article_metrics.sql` y `database/migrations/017_create_messages.sql` en orden, después de crear `submission_reviews`.

El centro de ayuda está disponible en `/api/help`: las consultas públicas solo muestran contenido activo y permiten filtrar por `type`, `category` y `audience`. La gestión (listado completo, creación, actualización y eliminación) requiere un usuario `editor` o `admin`.

### Búsqueda pública de artículos

`GET /api/search` (también disponible en `/api/public/search`) busca artículos publicados en números públicos. Acepta `q` o `query` para buscar en título, resumen y palabras clave; `author` para filtrar nombre, correo o afiliación; y los filtros `volume`, `issue`, `section`, `year` y `doi`. `sort` admite `relevance` (predeterminado con texto de búsqueda), `recent` (predeterminado sin texto) o `title`. La paginación usa `page` (predeterminado `1`) y `limit` (predeterminado `20`, máximo `100`). La respuesta incluye `articles` y `pagination` (`page`, `limit`, `total`, `totalPages`); los filtros se pueden combinar.

### Citas, exportación bibliográfica y métricas públicas

Estos endpoints son públicos y solo reconocen artículos cuyo estado editorial sea publicado/aceptado y pertenezcan a un número público:

| Método | Endpoint | Descripción |
| ------ | -------- | ----------- |
| GET | `/api/public/articles/:id/citation?style=apa` | Devuelve la cita en APA 7; `style` también admite `ieee` y por defecto es `apa` |
| GET | `/api/public/articles/:id/citation/export?format=bibtex` | Descarga la referencia en BibTeX (`.bib`); `format=ris` descarga RIS (`.ris`) |
| GET | `/api/public/articles/:id/metrics` | Consulta contadores públicos `views` y `downloads` |

Las referencias usan nombres de autores en el orden registrado, título, *Revista Mundo FESC*, volumen, número, año y DOI cuando existe; en ausencia de DOI incluyen la URL pública del artículo. No se asignan páginas porque el esquema actual no almacena paginación. Un artículo no publicado devuelve `404`; un estilo o formato desconocido devuelve `400`. Las vistas incrementan al consultar el detalle público (`/api/public/submissions/:id`) y las descargas al servir cualquier galera PDF/HTML. Los contadores se almacenan en `article_metrics`; en bases existentes aplica la migración `016_create_article_metrics.sql`.

### Plantillas de correo

Todas estas rutas requieren autenticación y el rol `admin` o `editor`. Las plantillas se gestionan bajo `/api/email-templates`; `variables_disponibles` es una lista JSON de identificadores y, si se omite al crear o actualizar, se extrae de los marcadores `{{variable}}` del asunto y el cuerpo HTML.

| Método | Endpoint | Descripción |
| ------ | -------- | ----------- |
| GET | `/api/email-templates` | Listar plantillas |
| GET | `/api/email-templates/:templateKey` | Consultar una plantilla por clave |
| POST | `/api/email-templates` | Crear con `template_key`, `name`, `subject`, `body_html` y, opcionalmente, `variables_disponibles` |
| PUT | `/api/email-templates/:templateKey` | Reemplazar `name`, `subject`, `body_html` y, opcionalmente, `variables_disponibles` |

Ejemplo de marcadores admitidos: `{{nombre_autor}}`, `{{titulo_articulo}}` y `{{rol}}`. La respuesta expone `variables_disponibles` como una lista.

Las decisiones aceptada, rechazada y cambios solicitados envían, al cambiar realmente el estado, las plantillas `submission_accepted`, `submission_rejected` y `submission_changes_requested` al correo del autor. Asignar un evaluador envía `reviewer_assigned` al evaluador. Las plantillas incluyen además `{{estado}}`, `{{comentarios_editor}}`, `{{submission_id}}`, `{{nombre_revisor}}` y `{{fecha_limite}}` según corresponda. Si falta SMTP, una plantilla o una variable, el error queda registrado en el backend y no revierte la acción editorial ya guardada.

### Mensajería interna

Las rutas de mensajería requieren autenticación JWT. Los mensajes se guardan en MySQL y cada cuenta solo puede consultar mensajes en los que participa; además, puede consultar mensajes asociados a envíos a los que tiene acceso por rol (autor propietario, revisor asignado, editor o administrador). Solo el destinatario puede marcar un mensaje como leído. El borrado se aplica por participante y no elimina el mensaje de la otra persona.

| Método | Endpoint | Descripción |
| ------ | -------- | ----------- |
| GET | `/api/messages` | Lista mensajes accesibles para el usuario autenticado, del más reciente al más antiguo |
| GET | `/api/messages/recipients` | Lista usuarios disponibles como destinatarios, excepto el usuario autenticado |
| GET | `/api/messages/conversation/:userId` | Obtiene los mensajes de la conversación 1:1 con el usuario indicado |
| GET | `/api/messages/:id` | Obtiene el detalle de un mensaje si el usuario participa o tiene acceso al envío asociado |
| POST | `/api/messages` | Envía un mensaje JSON: `{"recipientId":"<id>","subject":"Asunto","body":"Contenido","submissionId":"<id opcional>"}` |
| PATCH | `/api/messages/:id/read` | Marca el mensaje como leído (solo su destinatario) |
| DELETE | `/api/messages/:id` | Oculta el mensaje para el participante autenticado |

Un ID de envío incluido al enviar debe corresponder a un envío accesible para el remitente. El endpoint de lectura y los intentos de consultar, enviar o eliminar fuera del alcance autorizado responden `403`. En instalaciones existentes aplica `database/migrations/017_create_messages.sql`; el esquema nuevo también crea la tabla `messages`.

### Analíticas editoriales

Estos endpoints requieren autenticación y el rol `admin` o `editor`:

| Método | Endpoint | Descripción |
| ------ | -------- | ----------- |
| GET | `/api/analytics/overview` | Conteo filtrable de artículos por estado, tasa de aceptación y usuarios por rol |
| GET | `/api/analytics/editorial-times` | Promedio filtrable de días hasta la decisión editorial y cumplimiento de revisiones asignadas |
| GET | `/api/analytics/issues-summary` | Artículos publicados filtrados y agrupados por número, volumen y fecha de publicación |
| GET | `/api/analytics/reviewers` | Rendimiento filtrable por evaluador: asignadas, completadas, pendientes, tasa de cumplimiento y días promedio de respuesta |

Los cuatro endpoints aceptan opcionalmente `startDate` y `endDate` (`AAAA-MM-DD`, inclusivos), `issueId` (identificador del número/volumen) y `section` (nombre exacto de la sección). Las fechas se aplican a `fecha_envio`; las consultas usan parámetros enlazados. Por ejemplo: `/api/analytics/overview?startDate=2026-01-01&endDate=2026-12-31&issueId=4&section=Art%C3%ADculos%20de%20Investigaci%C3%B3n`. Los días promedio de respuesta se calculan para revisiones completadas con la diferencia entre la asignación y la última actualización del envío; si no hay revisiones completadas, el valor es `null`.

### Logs de auditoría

Estos endpoints requieren autenticación JWT y exclusivamente el rol `admin`:

| Método | Endpoint | Descripción |
| ------ | -------- | ----------- |
| GET | `/api/audit-logs` | Lista logs con paginación (`page`, `limit`, máximo 100) y filtros opcionales `userId`, `action`, `target`, `startDate` y `endDate` |
| GET | `/api/audit-logs/summary` | Devuelve el total de registros y el conteo agrupado por acción |

El listado incluye el nombre y correo del usuario asociado, si existe, y ordena del más reciente al más antiguo.


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
