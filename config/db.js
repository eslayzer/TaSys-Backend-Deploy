// Importa el módulo mysql2 con soporte para promesas
const mysql = require('mysql2/promise');
// Carga las variables de entorno desde el archivo .env
require('dotenv').config();

// Crea un pool de conexiones a la base de datos
// Esto permite reutilizar conexiones y mejorar el rendimiento
const pool = mysql.createPool({
    host: process.env.DB_HOST,        // Host de la base de datos (ej. localhost)
    user: process.env.DB_USER,        // Usuario de la base de datos (ej. root)
    password: process.env.DB_PASSWORD, // Contraseña del usuario de la base de datos
    database: process.env.DB_DATABASE, // Nombre de la base de datos (ej. tasys_db)
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
