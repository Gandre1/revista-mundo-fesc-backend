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

5. Importa el archivo `schema.sql` ubicado en la raíz del proyecto para crear la estructura de tablas

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
```

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
| GET    | /api/submissions/my-submissions | Listar borradores del autor logueado (requiere JWT) |

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
