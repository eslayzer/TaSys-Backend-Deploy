// tasks.routes.js
const express = require('express');

// Este módulo ahora exporta una función que toma 'pool' como argumento
// y devuelve una instancia de Express Router.
module.exports = (pool) => {
    const router = express.Router();
    // Importa el controlador, pasándole el pool para que las funciones tengan acceso a él
    const tasksController = require('../controllers/tasks.controller')(pool);

    // Ruta para crear una nueva tarea (POST /api/tasks)
    router.post('/', tasksController.createTask);

    // Ruta para obtener todas las tareas (GET /api/tasks)
    router.get('/', tasksController.getAllTasks);

    // [RF-002] Ruta para actualizar una tarea por su ID (PUT /api/tasks/:id)
    router.put('/:id', tasksController.updateTask);

    // [RF-003] Ruta para eliminar una tarea por su ID (DELETE /api/tasks/:id)
    router.delete('/:id', tasksController.deleteTask);

    // [RF-007] Ruta para obtener tareas hijas (dependencias) de una tarea (GET /api/tasks/:id/children)
    router.get('/:id/children', tasksController.getTaskChildren);

    // [RF-008] Ruta para establecer una tarea padre para una tarea (PUT /api/tasks/:id/set-parent)
    router.put('/:id/set-parent', tasksController.setTaskParent);

    // [RF-009] Ruta para eliminar una tarea padre de una tarea (DELETE /api/tasks/:id/remove-parent)
    router.delete('/:id/remove-parent', tasksController.removeTaskParent);

    // [RF-010] Ruta para obtener el historial de cambios de una tarea (GET /api/tasks/:id/history)
    router.get('/:id/history', tasksController.getTaskHistory);

    // [RF-011] Ruta para obtener tareas vencidas (GET /api/tasks/overdue)
    router.get('/overdue', tasksController.getOverdueTasks); // ¡Añadida!

    // [RF-012] Ruta para obtener tareas recién creadas (GET /api/tasks/newly-created)
    router.get('/newly-created', tasksController.getNewlyCreatedTasks); // ¡Añadida!


    return router; // ¡MUY IMPORTANTE! DEBE DEVOLVER EL OBJETO router
};
