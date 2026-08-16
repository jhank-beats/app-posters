-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: posters
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cargar_posters`
--

DROP TABLE IF EXISTS `cargar_posters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cargar_posters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titulo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `autores` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `categoria` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `palabrasClave` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `ruta_imagen` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `id_usuario` int DEFAULT NULL,
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_poster_usuario` (`id_usuario`),
  CONSTRAINT `fk_poster_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cargar_posters`
--

LOCK TABLES `cargar_posters` WRITE;
/*!40000 ALTER TABLE `cargar_posters` DISABLE KEYS */;
INSERT INTO `cargar_posters` VALUES (8,'probando Conexion','probador','probando al envio del poster','calculo','pobaanndo','src/assets/imgPosters/StockSnap_YZ00UZN69T.jpg',11,'2025-11-07 02:37:59'),(19,'atrehtr','adfg','sfdghg','desarrolloWeb','sdfh','src/assets/imgPosters/pexels-kaique-rocha-242140.jpg',11,'2025-11-07 12:54:04'),(20,'Sistemas de Seguridad','Juan Camilo, Andres, Cabezas','poster explicativo de un sistema de seguridad','programacion','seguridad, sistemas','src/assets/imgPosters/Sistema de Seguridad.pdf',14,'2025-11-08 15:22:29'),(21,'Nuevo Modelo frontend','valentina, juanita marea','modelo frontend renovado para la página del gobierno','frontend','frontend, gobierno, pagina, web','src/assets/imgPosters/Nuevo modelo frontend.png',16,'2025-11-08 15:28:17'),(26,'probandojuanita','juanita artemiza','sfjwpgjrek','calculo','sffdbe','src/assets/imgPosters/Nuevo modelo frontend.png',11,'2025-11-11 04:47:29'),(38,'videojuego','jonathan','videojuego para tin y para tan','programacion','dfgh','src/assets/imgPosters/VideoJuego Adaptativo.pdf',18,'2025-11-15 00:49:39'),(39,'poster videojuegos','alex, juan','videojuego para...','programacion','videojuego, funcional','src/assets/imgPosters/VideoJuego Adaptativo.pdf',19,'2025-11-21 04:32:19'),(40,'videojuego3','oscar, juanito','videojuego realizado...','backend','juegos, videojuegos','src/assets/imgPosters/VideoJuego Adaptativo.pdf',20,'2025-11-21 04:59:14'),(41,'estadisticas para pandemias','pepito, juanito','abc...','estadistica','pandemias, estadistica','src/assets/imgPosters/Estadistica de pandemia.pdf',9,'2025-11-21 22:44:18'),(42,'Probando de Nuevo','pepito, juanito','probando lo de los posters','desarrolloWeb','programación','src/assets/imgPosters/Estadistica de pandemia.pdf',9,'2026-03-06 12:45:29');
/*!40000 ALTER TABLE `cargar_posters` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-23 19:35:01
