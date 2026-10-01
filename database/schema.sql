-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: localhost    Database: revista_mundo_fesc
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `authors`
--

DROP TABLE IF EXISTS `authors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `authors` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_id` varchar(36) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellidos` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `afiliacion` varchar(200) DEFAULT NULL,
  `pais` varchar(100) DEFAULT NULL,
  `orcid` varchar(255) DEFAULT NULL,
  `es_corresponsal` tinyint(1) DEFAULT 0,
  `orden` int(11) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `submission_id` (`submission_id`),
  CONSTRAINT `authors_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `authors`
--

LOCK TABLES `authors` WRITE;
/*!40000 ALTER TABLE `authors` DISABLE KEYS */;
INSERT INTO `authors` VALUES (1,'097fc120-a2ee-4b82-86eb-5ec2bbca1a81','Juan','Perez','J_Perez@fesc.edu.co','Universidad FESC','Colombia',NULL,0,2),(2,'9f7f72cf-97d5-4411-95a2-fd5925d33b31','Carlos','Mendoza','cmendoza@fesc.edu.co','Universidad FESC','Colombia',NULL,0,2),(5,'4fbfc52f-e8ac-4275-b2f0-403255d98e13','Jaime','Gomez','J_Gomez@Prueba.com','FESC','Colombia','0000-0000-0000-0000',1,2);
/*!40000 ALTER TABLE `authors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `submission_files`
--

DROP TABLE IF EXISTS `submission_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `submission_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_id` varchar(36) NOT NULL,
  `nombre_original` varchar(255) NOT NULL,
  `ruta_almacenamiento` varchar(255) NOT NULL,
  `tamano` int(11) NOT NULL,
  `tipo` varchar(30) NOT NULL,
  `fecha_subida` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `submission_id` (`submission_id`),
  CONSTRAINT `submission_files_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4783 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `submission_files`
--

LOCK TABLES `submission_files` WRITE;
/*!40000 ALTER TABLE `submission_files` DISABLE KEYS */;
INSERT INTO `submission_files` VALUES (1,'097fc120-a2ee-4b82-86eb-5ec2bbca1a81','prueba3.docx','uploads\\archivo-1790177084882-633271034.docx',91399,'manuscrito','2026-09-23 15:24:44'),(9,'9f7f72cf-97d5-4411-95a2-fd5925d33b31','prueba3.docx','uploads\\archivo-1790361689416-571954623.docx',91399,'manuscrito','2026-09-25 18:41:29'),(95,'4fbfc52f-e8ac-4275-b2f0-403255d98e13','Prueba.docx','uploads\\archivo-1790798974874-486549006.docx',13327,'manuscrito','2026-09-30 20:09:34');
/*!40000 ALTER TABLE `submission_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `submissions`
--

DROP TABLE IF EXISTS `submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `submissions` (
  `id` varchar(36) NOT NULL,
  `titulo` text NOT NULL,
  `resumen` text DEFAULT NULL,
  `palabras_clave` text DEFAULT NULL,
  `seccion` varchar(100) DEFAULT NULL,
  `idioma` varchar(10) DEFAULT 'es',
  `estado` varchar(30) DEFAULT 'Nuevo',
  `borrador` tinyint(1) DEFAULT 1,
  `paso_wizard` int(11) DEFAULT 1,
  `referencias` text DEFAULT NULL,
  `comentarios_editor` text DEFAULT NULL,
  `autor_id` varchar(36) NOT NULL,
  `editor_id` varchar(36) DEFAULT NULL,
  `fecha_envio` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `autor_id` (`autor_id`),
  KEY `editor_id` (`editor_id`),
  CONSTRAINT `submissions_ibfk_1` FOREIGN KEY (`autor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `submissions_ibfk_2` FOREIGN KEY (`editor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `submissions`
--

LOCK TABLES `submissions` WRITE;
/*!40000 ALTER TABLE `submissions` DISABLE KEYS */;
INSERT INTO `submissions` VALUES ('097fc120-a2ee-4b82-86eb-5ec2bbca1a81','Estudio sobre Inteligencia Artificial aplicada a Revistas Académicas','Resumen técnico de la investigación...','IA, Web, Software','Investigación','es','enviado',0,1,NULL,NULL,'7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad',NULL,'2026-09-24 16:08:39','2026-09-21 20:31:20','2026-09-24 16:08:39'),('4fbfc52f-e8ac-4275-b2f0-403255d98e13','Titulo Prueba','Prueba Resumen','Prueba, Dos','Artículos Originales','Español','Nuevo',1,1,NULL,NULL,'7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad',NULL,NULL,'2026-09-30 19:54:38','2026-09-30 19:54:56'),('9f7f72cf-97d5-4411-95a2-fd5925d33b31','Estudio de Impacto de Software Libre en la Educación Superior','Este artículo analiza la adopción de herramientas Open Source en entornos académicos...','software libre, educacion, tecnologia','Artículos de Investigación','es','enviado',0,1,NULL,NULL,'7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad',NULL,'2026-09-25 18:42:47','2026-09-25 18:39:19','2026-09-25 18:42:47');
/*!40000 ALTER TABLE `submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellidos` varchar(100) DEFAULT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'author',
  `afiliacion` varchar(200) DEFAULT NULL,
  `pais` varchar(100) DEFAULT NULL,
  `orcid` varchar(50) DEFAULT NULL,
  `notificaciones` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad','Andres','Pérez','autor@fesc.edu.co','$2b$10$r4ug89YiQ6z4qpd4l9RXTuscSQ6JigXph4DB.3IKfUeKk8NCmcLvq','author','Universidad FESC','Colombia','0000-0002-1825-0097',1,'2026-09-18 14:04:06','2026-09-28 19:42:15');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'revista_mundo_fesc'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-01 15:59:59
