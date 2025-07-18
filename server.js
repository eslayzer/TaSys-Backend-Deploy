// server.js
// Carga las variables de entorno desde el archivo .env
require('dotenv').config();

const express = require('express');
// Importa el pool de conexiones de la base de datos
// Ahora, 'pool' contendrá la instancia real del pool de conexiones
const pool = require('./config/db');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Middlewares

// *** CONFIGURACIÓN DE CORS (TEMPORALMENTE PERMISIVA PARA DEPURAR) ***
// ¡ADVERTENCIA!: Esta configuración permite solicitudes desde CUALQUIER origen.
// NO usar en producción sin un 'origin' específico por motivos de seguridad.
app.use(cors()); // <-- ¡CAMBIO AQUÍ! Elimina la configuración de 'origin', 'methods', 'allowedHeaders'

app.use(express.json());

// Importa las rutas de tareas y les pasa el pool de conexiones
// tasksRoutes ahora será la instancia del router configurado
const tasksRoutes = require('./routes/tasks.routes')(pool); // <-- ¡Aquí se le pasa el pool!

console.log('DEBUG: Tipo de tasksRoutes antes de app.use:', typeof tasksRoutes);
console.log('DEBUG: Valor de tasksRoutes antes de app.use:', tasksRoutes);
// Usa las rutas de tareas bajo el prefijo /api/tasks
app.use('/api/tasks', tasksRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('API de TASys en funcionamiento!');
});

// Manejador de errores para rutas no encontradas
app.use((req, res, next) => {
    res.status(404).json({ message: 'Ruta no encontrada. Por favor, verifique la URL.' });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor de TASys corriendo en http://localhost:${port}`);
});
