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
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombres` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `apellidos` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `correo` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `contraseña` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `carrera` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `id_rol` int DEFAULT '1',
  `activo` tinyint(1) DEFAULT NULL,
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `desactivado` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_usuario_rol` (`id_rol`),
  CONSTRAINT `fk_usuario_rol` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
INSERT INTO `usuario` VALUES (7,'Camilo andres','Moncaleano Murillo','camilo@gmail.com','$2y$10$ff6Dp6cTE32lNM/edH1GOehSyd.km7LCm26l/cLs2NbGLxvih1TPK','sistemas',4,1,'2025-11-01 23:49:41',0),(8,'leonardo','vaca','leonardo@gmail.com','$2y$10$RenWKiSDoguHM5h6XXLbiezCdoxDaxMt/4StcdC/pk/5PHCn.gdPa','administracion',1,1,'2025-11-01 23:49:41',0),(9,'pepito','perez','pepito@gmail.com','$2y$10$ET4ngzTVu2etVXmqS3xSLu5RTprzqcOcWZ4y3MO/tkS9a72iZZAou','derecho',1,1,'2025-11-01 23:49:41',0),(10,'pp','cc','pp@gmail.com','$2y$10$bqqm/tYYbwQjDSi8ljL7Jei.YfInsDKn/wgTHtXglIIDZQORo94IW','civil',1,1,'2025-11-04 20:01:10',0),(11,'juanita','artemiza','juanita@gmail.com','$2y$10$m1C2LJZB3epOvGWi17dBzOLZzZYvJBMznWybgTSvbOLpsNE7CJTWy','sistemas',1,1,'2025-11-06 19:23:15',0),(13,'riana','rodriguez','riana@gmail.com','$2y$10$AdZrhoHGYqDWO4OifjABWOVM/3tr7uE7Xeh2zJv3mRa/6qZHzPuUm','civil',1,1,'2025-11-06 19:27:48',0),(14,'Juan Camilo ','Murillo Moncaleano','juan@gmail.com','$2y$10$BC9LCnnZkw/PDGclRKpjVuDZFZ0xOJMqnU.VwPB5SIPVD8gS/bTUC','sistemas',2,1,'2025-11-08 15:15:59',0),(16,'Valentina Alexandra','Torres Muñoz','valentina@gmail.com','$2y$10$5dcf2gpB7y8y8ocUJoiMgOAz/1K4SINNQf18PCYRQ56fkLbhBBxiG','administracion',1,1,'2025-11-08 15:18:41',0),(17,'Diego Alejandro','Fernandez Cruz','diego@gmail.com','$2y$10$S8cMXe0uCHvQ2obX9wYxoeK88Egaxahdb59SdG1iVpI6xZQt9Qugm','civil',3,1,'2025-11-12 19:17:23',0),(18,'jonathan ','moreno','jonathan@gmail.com','$2y$10$bf5bXo8DXaSleZCmLkLzL.l4vxXGIjhcu99bcXyELtQTil1jmvuUK','derecho',1,1,'2025-11-14 22:21:31',0),(19,'alex andres','santos','alex@gmail.com','$2y$10$Y5MYrpKbKjldArL9iAsbz.LFO9mKE58aQoOrhwNySxI3WkfYCPGLq','administracion',2,1,'2025-11-21 04:30:33',0),(20,'oscar albeiro','lozano','oscar@gmail.com','$2y$10$w9lpVJjvCCsLMmkMS71nZOT28IPk.oSN3QlQhEoKghpHe86x3Of.y','civil',1,1,'2025-11-21 04:57:13',0),(21,'pepito','juanito','pepito@gmail.com','$2y$10$Gmg3dNvt3O7XPvnT.iRn0O5K8j.ib88sLOPXXn6oAMRvZ4Z3phKDO','administracion',1,1,'2025-11-21 22:42:01',0),(22,'JuanC','Murillo','juanc@gmail.com','1234','Sistemas',4,1,'2026-03-04 13:53:08',0);
/*!40000 ALTER TABLE `usuario` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-23 19:35:00
