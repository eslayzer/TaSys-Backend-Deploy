// tasks.controller.js
// Este módulo exporta una función que toma el pool de conexiones
// y devuelve un objeto con las funciones del controlador.

module.exports = (pool) => { // Recibe el pool como argumento aquí

    // Helper function para crear un timestamp UTC normalizado a medianoche
    const createUtcMidnightTimestamp = (dateString) => {
        // Parsear la cadena de fecha (YYYY-MM-DD) en componentes
        const parts = dateString.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Meses son base 0 en JavaScript
        const day = parseInt(parts[2]);

        // Crear y devolver un timestamp UTC para la medianoche de ese día
        return Date.UTC(year, month, day, 0, 0, 0, 0);
    };

    // [RF-001] Crear una nueva tarea
    const createTask = async (req, res) => {
        let { titulo, descripcion, prioridad, categoria, fecha_limite, estado, id_tarea_padre } = req.body;

        if (!titulo || !categoria) {
            return res.status(400).json({ message: 'Título y categoría son campos obligatorios.' });
        }

        // Lógica para establecer estado 'Vencida' si la fecha límite ya pasó
        if (fecha_limite) {
            const limiteTimestampUTC = createUtcMidnightTimestamp(fecha_limite);

            const today = new Date();
            const todayString = today.toISOString().split('T')[0];
            const todayTimestampUTC = createUtcMidnightTimestamp(todayString);

            if (limiteTimestampUTC < todayTimestampUTC) {
                estado = 'Vencida'; // Sobrescribe el estado si la fecha ya pasó
            }
        }

        try {
            const [result] = await pool.execute(
                `INSERT INTO tareas (titulo, descripcion, prioridad, categoria, fecha_limite, estado, id_tarea_padre)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [titulo, descripcion, prioridad || 'Media', categoria, fecha_limite, estado || 'Pendiente', id_tarea_padre || null]
            );

            const newTaskId = result.insertId;
            await pool.execute(
                `INSERT INTO historial_tarea (id_tarea, campo_modificado, valor_nuevo, usuario_cambio)
                 VALUES (?, ?, ?, ?)`,
                [newTaskId, 'Creación de tarea', `Tarea creada con estado: ${estado}`, 'Sistema/UsuarioInicial']
            );

            res.status(201).json({
                message: 'Tarea creada exitosamente',
                id_tarea: newTaskId,
                task: req.body
            });

        } catch (error) {
            console.error('Error al crear la tarea:', error);
            res.status(500).json({ message: 'Error interno del servidor al crear la tarea.', error: error.message });
        }
    };

    // [RF-006] Obtener todas las tareas
    const getAllTasks = async (req, res) => {
        try {
            const [rows] = await pool.execute(`
                SELECT
                    t.id_tarea,
                    t.titulo,
                    t.descripcion,
                    t.prioridad,
                    t.categoria,
                    t.fecha_limite,
                    t.estado,
                    t.id_tarea_padre,
                    tp.titulo AS tarea_padre_titulo,
                    t.fecha_creacion,
                    t.fecha_actualizacion
                FROM
                    tareas t
                LEFT JOIN
                    tareas tp ON t.id_tarea_padre = tp.id_tarea
                ORDER BY
                    t.fecha_creacion DESC
            `);
            res.status(200).json(rows);
        } catch (error) {
            console.error('Error al obtener las tareas:', error);
            res.status(500).json({ message: 'Error interno del servidor al obtener las tareas.', error: error.message });
        }
    };

    // [RF-002] Actualizar una tarea por su ID
    const updateTask = async (req, res) => {
        const { id } = req.params;
        let { titulo, descripcion, prioridad, categoria, fecha_limite, estado, id_tarea_padre } = req.body;

        if (!titulo || !categoria || !fecha_limite || !prioridad || !estado) {
            return res.status(400).json({ message: 'Título, categoría, fecha límite, prioridad y estado son campos obligatorios para actualizar.' });
        }

        // Lógica para establecer estado 'Vencida' si la fecha límite ya pasó (al actualizar)
        if (fecha_limite) {
            const limiteTimestampUTC = createUtcMidnightTimestamp(fecha_limite);

            const today = new Date();
            const todayString = today.toISOString().split('T')[0];
            const todayTimestampUTC = createUtcMidnightTimestamp(todayString);

            if (limiteTimestampUTC < todayTimestampUTC) {
                estado = 'Vencida'; // Sobrescribe el estado si la fecha ya pasó
            }
        }

        // [RF-004] Validación de dependencia para el estado "Completada"
        if (estado === 'Completada') {
            try {
                const [childTasks] = await pool.execute(
                    `SELECT id_tarea, titulo, estado FROM tareas WHERE id_tarea_padre = ? AND estado != 'Completada'`,
                    [id]
                );
                if (childTasks.length > 0) {
                    const uncompletedChildren = childTasks.map(t => t.titulo).join(', ');
                    return res.status(400).json({ message: `No se puede completar esta tarea. Las siguientes subtareas aún no están completadas: ${uncompletedChildren}.` });
                }
            } catch (error) {
                console.error('Error al verificar subtareas para completar:', error);
                return res.status(500).json({ message: 'Error interno del servidor al verificar dependencias.' });
            }
        }

        try {
            const [currentTaskRows] = await pool.execute('SELECT * FROM tareas WHERE id_tarea = ?', [id]);
            const currentTask = currentTaskRows[0];

            if (!currentTask) {
                return res.status(404).json({ message: 'Tarea no encontrada para actualizar.' });
            }

            const [result] = await pool.execute(
                `UPDATE tareas
                 SET titulo = ?, descripcion = ?, prioridad = ?, categoria = ?, fecha_limite = ?, estado = ?, id_tarea_padre = ?, fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE id_tarea = ?`,
                [titulo, descripcion, prioridad, categoria, fecha_limite, estado, id_tarea_padre || null, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Tarea no encontrada o no se pudo actualizar.' });
            }

            await pool.execute(
                `INSERT INTO historial_tarea (id_tarea, campo_modificado, valor_nuevo, usuario_cambio)
                 VALUES (?, ?, ?, ?)`,
                [id, 'Actualización de tarea', `Tarea actualizada con estado: ${estado}`, 'Sistema/Usuario']
            );

            res.status(200).json({ message: 'Tarea actualizada exitosamente.', id_tarea: id, updated_data: req.body });

        } catch (error) {
            console.error('Error al actualizar la tarea:', error);
            res.status(500).json({ message: 'Error interno del servidor al actualizar la tarea.', error: error.message });
        }
    };

    // [RF-003] Eliminar una tarea por su ID
    const deleteTask = async (req, res) => {
        const { id } = req.params;

        try {
            const [taskToDeleteRows] = await pool.execute('SELECT titulo FROM tareas WHERE id_tarea = ?', [id]);
            const taskTitle = taskToDeleteRows[0] ? taskToDeleteRows[0].titulo : `Tarea ID ${id}`;

            await pool.execute(
                `INSERT INTO historial_tarea (id_tarea, campo_modificado, valor_nuevo, usuario_cambio)
                 VALUES (?, ?, ?, ?)`,
                [id, 'Eliminación de tarea', `Tarea "${taskTitle}" eliminada`, 'Sistema/Usuario']
            );

            const [result] = await pool.execute(
                `DELETE FROM tareas WHERE id_tarea = ?`,
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Tarea no encontrada para eliminar.' });
            }

            res.status(200).json({ message: 'Tarea eliminada exitosamente.' });

        } catch (error) {
            console.error('Error al eliminar la tarea:', error);
            res.status(500).json({ message: 'Error interno del servidor al eliminar la tarea.', error: error.message });
        }
    };

    // [RF-007] Obtener tareas hijas (dependencias) de una tarea
    const getTaskChildren = async (req, res) => {
        const { id } = req.params;
        try {
            const [rows] = await pool.execute(
                `SELECT id_tarea, titulo, estado FROM tareas WHERE id_tarea_padre = ?`,
                [id]
            );
            res.status(200).json(rows);
        } catch (error) {
            console.error('Error al obtener tareas hijas:', error);
            res.status(500).json({ message: 'Error interno del servidor al obtener tareas hijas.', error: error.message });
        }
    };

    // [RF-008] Establecer una tarea padre para una tarea
    const setTaskParent = async (req, res) => {
        const { id } = req.params; // ID de la tarea que será la hija
        const { parent_task_id } = req.body; // ID de la tarea que será la padre

        if (!parent_task_id) {
            return res.status(400).json({ message: 'El ID de la tarea padre es obligatorio.' });
        }
        if (parseInt(id) === parseInt(parent_task_id)) {
            return res.status(400).json({ message: 'Una tarea no puede ser su propia tarea padre.' });
        }

        try {
            // Verificar que la tarea padre exista
            const [parentTaskRows] = await pool.execute('SELECT id_tarea FROM tareas WHERE id_tarea = ?', [parent_task_id]);
            if (parentTaskRows.length === 0) {
                return res.status(404).json({ message: 'La tarea padre especificada no existe.' });
            }

            // Verificar que la tarea hija exista
            const [childTaskRows] = await pool.execute('SELECT id_tarea FROM tareas WHERE id_tarea = ?', [id]);
            if (childTaskRows.length === 0) {
                return res.status(404).json({ message: 'La tarea hija especificada no existe.' });
            }

            // Verificar si la tarea padre ya tiene esta tarea como su hija (evitar ciclos simples)
            const [existingParent] = await pool.execute(
                `SELECT id_tarea_padre FROM tareas WHERE id_tarea = ?`,
                [parent_task_id]
            );
            if (existingParent.length > 0 && existingParent[0].id_tarea_padre === parseInt(id)) {
                return res.status(400).json({ message: 'No se puede establecer la dependencia: crearía un ciclo (la tarea padre ya depende de esta tarea).' });
            }


            const [result] = await pool.execute(
                `UPDATE tareas SET id_tarea_padre = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_tarea = ?`,
                [parent_task_id, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'No se pudo establecer la dependencia. Tarea no encontrada.' });
            }

            await pool.execute(
                `INSERT INTO historial_tarea (id_tarea, campo_modificado, valor_nuevo, usuario_cambio)
                 VALUES (?, ?, ?, ?)`,
                [id, 'Dependencia establecida', `Tarea padre establecida a ID: ${parent_task_id}`, 'Sistema/Usuario']
            );

            res.status(200).json({ message: `Dependencia establecida: Tarea ${id} ahora depende de Tarea ${parent_task_id}.` });

        } catch (error) {
            console.error('Error al establecer la dependencia:', error);
            res.status(500).json({ message: 'Error interno del servidor al establecer la dependencia.', error: error.message });
        }
    };

    // [RF-009] Eliminar una tarea padre de una tarea
    const removeTaskParent = async (req, res) => {
        const { id } = req.params; // ID de la tarea cuya dependencia se eliminará

        try {
            const [result] = await pool.execute(
                `UPDATE tareas SET id_tarea_padre = NULL, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_tarea = ?`,
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'No se pudo eliminar la dependencia. Tarea no encontrada.' });
            }

            await pool.execute(
                `INSERT INTO historial_tarea (id_tarea, campo_modificado, valor_nuevo, usuario_cambio)
                 VALUES (?, ?, ?, ?)`,
                [id, 'Dependencia eliminada', 'Tarea padre eliminada', 'Sistema/Usuario']
            );

            res.status(200).json({ message: `Dependencia eliminada para la Tarea ${id}.` });

        } catch (error) {
            console.error('Error al eliminar la dependencia:', error);
            res.status(500).json({ message: 'Error interno del servidor al eliminar la dependencia.', error: error.message });
        }
    };

    // [RF-010] Obtener historial de cambios de una tarea
    const getTaskHistory = async (req, res) => {
        const { id } = req.params; // ID de la tarea para la que queremos el historial
        try {
            const [rows] = await pool.execute(
                `SELECT
                    id_historial,
                    id_tarea,
                    campo_modificado,
                    valor_anterior,
                    valor_nuevo,
                    fecha_cambio,
                    usuario_cambio
                FROM
                    historial_tarea
                WHERE
                    id_tarea = ?
                ORDER BY
                    fecha_cambio DESC`, // Ordenar por fecha de cambio descendente
                [id]
            );
            res.status(200).json(rows);
        } catch (error) {
            console.error('Error al obtener el historial de la tarea:', error);
            res.status(500).json({ message: 'Error interno del servidor al obtener el historial de la tarea.', error: error.message });
        }
    };

    // [RF-011] Obtener tareas vencidas
    const getOverdueTasks = async (req, res) => {
        try {
            const [rows] = await pool.execute(
                `SELECT id_tarea, titulo, fecha_limite FROM tareas WHERE estado = 'Vencida' ORDER BY fecha_limite ASC`
            );
            res.status(200).json(rows);
        } catch (error) {
            console.error('Error al obtener tareas vencidas:', error);
            res.status(500).json({ message: 'Error interno del servidor al obtener tareas vencidas.', error: error.message });
        }
    };

    // [RF-012] Obtener tareas recién creadas (ej. en las últimas 24 horas)
    const getNewlyCreatedTasks = async (req, res) => {
        // Calcular la fecha de hace 24 horas
        const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
        // Formatear a 'YYYY-MM-DD HH:MM:SS' para MySQL
        const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString().slice(0, 19).replace('T', ' ');

        try {
            const [rows] = await pool.execute(
                `SELECT id_tarea, titulo, fecha_creacion, estado FROM tareas WHERE fecha_creacion >= ? AND (estado = 'Pendiente' OR estado = 'En Proceso') ORDER BY fecha_creacion DESC`,
                [twentyFourHoursAgoISO]
            );
            res.status(200).json(rows);
        } catch (error) {
            console.error('Error al obtener tareas recién creadas:', error);
            res.status(500).json({ message: 'Error interno del servidor al obtener tareas recién creadas.', error: error.message });
        }
    };


    // Devuelve un objeto con todas las funciones del controlador
    return {
        createTask,
        getAllTasks,
        updateTask,
        deleteTask,
        getTaskChildren,
        setTaskParent,
        removeTaskParent,
        getTaskHistory,
        getOverdueTasks,    // ¡Añadida!
        getNewlyCreatedTasks // ¡Añadida!
    };
};
