// Importa el módulo mysql2 con soporte para promesas
const mysql = require('mysql2/promise');
// Carga las variables de entorno desde el archivo .env (útil para desarrollo local)
require('dotenv').config();

// Crea un pool de conexiones a la base de datos
// Esto permite reutilizar conexiones y mejorar el rendimiento
const pool = mysql.createPool({
    // Prioriza el uso de DATABASE_URL si está disponible (como en Railway)
    // Si no está, usa las variables de entorno individuales para la configuración local
    uri: process.env.DATABASE_URL || `mysql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_DATABASE}`,
    waitForConnections: true,         // Si no hay conexiones disponibles, espera
    connectionLimit: 10,              // Número máximo de conexiones en el pool
    queueLimit: 0                     // Número máximo de solicitudes en la cola (0 = ilimitado)
});

// Función de prueba para verificar la conexión al iniciar la aplicación
async function testDbConnection() {
    try {
        // Obtiene una conexión del pool para probarla
        const connection = await pool.getConnection();
        console.log('Conexión a la base de datos MySQL establecida correctamente.');
        connection.release(); // Libera la conexión de vuelta al pool
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error.message);
        // Si la conexión a la DB es crítica, podrías considerar salir del proceso
        // process.exit(1);
    }
}

// Llama a la función de prueba al iniciar este módulo
testDbConnection();

// Exporta el pool de conexiones para que pueda ser utilizado en otros módulos (ej. controladores)
module.exports = pool;