// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';

function App() {
  // Estado para controlar la página actual que se muestra
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard', 'allTasks', 'createTask', 'taskDetails', 'dependencies', 'history'

  // Estados para funcionalidades de tareas
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null); // Para ver detalles/editar una tarea
  const [editedTask, setEditedTask] = useState(null); // Para manejar la tarea que se está editando

  // Estado para el formulario de nueva tarea
  const [newTask, setNewTask] = useState({
    titulo: '',
    descripcion: '',
    fecha_limite: '',
    prioridad: 'Media', // Valor por defecto
    estado: 'Pendiente', // Valor por defecto
    categoria: '',
    tarea_padre_id: null, // Para tareas dependientes
  });
  const [formMessage, setFormMessage] = useState(null); // Para mensajes de éxito/error del formulario (crear/editar/eliminar)

  // Estados para la gestión de dependencias
  const [dependencyTask, setDependencyTask] = useState(''); // ID de la tarea que tendrá una dependencia
  const [parentTaskForDependency, setParentTaskForDependency] = useState(''); // ID de la tarea que será la padre
  const [taskChildren, setTaskChildren] = useState([]); // Hijos de la tarea seleccionada en gestión de dependencias
  const [dependencyMessage, setDependencyMessage] = useState(null); // Mensajes para la sección de dependencias

  // Estados para el historial de tareas
  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState(''); // ID de la tarea para ver su historial
  const [taskHistory, setTaskHistory] = useState([]); // Historial de la tarea seleccionada
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Estados para las alertas (nuevas funcionalidades)
  const [showOverdueAlert, setShowOverdueAlert] = useState(false);
  const [overdueTasksList, setOverdueTasksList] = useState([]);
  const [showNewTasksAlert, setShowNewTasksAlert] = useState(false);
  const [newTasksList, setNewTasksList] = useState([]);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertContent, setAlertContent] = useState('');

  // Nuevos estados para los conteos de notificaciones
  const [overdueCount, setOverdueCount] = useState(0);
  const [newTasksCount, setNewTasksCount] = useState(0);

  // Estados para almacenar la última vez que se vieron las alertas (persistente)
  // Usamos useCallback para memoizar estas funciones y evitar recrearlas innecesariamente
  const [lastOverdueViewedTimestamp, setLastOverdueViewedTimestamp] = useState(() => {
    const storedTimestamp = localStorage.getItem('lastOverdueViewed');
    return storedTimestamp ? parseInt(storedTimestamp, 10) : 0; // 0 significa nunca visto
  });
  const [lastNewTasksViewedTimestamp, setLastNewTasksViewedTimestamp] = useState(() => {
    const storedTimestamp = localStorage.getItem('lastNewTasksViewed');
    return storedTimestamp ? parseInt(storedTimestamp, 10) : 0; // 0 significa nunca visto
  });


  // Función para cargar tareas desde el backend
  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Ordenar las tareas por fecha_creacion de más reciente a más antigua
      const sortedTasks = data.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
      setTasks(sortedTasks);
    } catch (e) {
      console.error("Error fetching tasks:", e);
      setError("Error al cargar las tareas. Por favor, intente de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener el conteo de tareas vencidas (filtrado por última revisión)
  const calculateOverdueCount = useCallback(async () => {
    try {
      const response = await fetch('/api/tasks/overdue');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Filtrar solo las tareas que se vencieron *después* de la última vez que se revisó
      const newOverdue = data.filter(task => {
        const taskOverdueDate = new Date(task.fecha_limite).getTime(); // Convertir a timestamp
        // Consideramos que una tarea es "nueva vencida" si su fecha límite es anterior a hoy
        // Y si la tarea fue actualizada a "Vencida" o su fecha límite pasó después de la última revisión.
        // Simplificación: si su fecha límite es anterior a hoy y la última vez que la vimos fue antes de hoy.
        // O si la tarea fue marcada como 'Vencida' después de la última revisión.
        // Para ser más precisos, necesitamos la fecha en que cambió a 'Vencida'.
        // Por ahora, nos basaremos en la fecha de actualización si es más reciente que la fecha límite
        // o simplemente la fecha límite si es el único indicador de "vencida".

        // Para una lógica más robusta, idealmente el backend debería darnos la fecha de cambio de estado.
        // Dado que no la tenemos, usaremos la fecha de actualización si es más reciente que la fecha límite,
        // o la fecha límite misma.
        const relevantDate = task.fecha_actualizacion ? new Date(task.fecha_actualizacion).getTime() : taskOverdueDate;

        return relevantDate > lastOverdueViewedTimestamp;
      });
      setOverdueCount(newOverdue.length);
    } catch (error) {
      console.error("Error al obtener el conteo de tareas vencidas:", error);
      setOverdueCount(0); // Resetear conteo en caso de error
    }
  }, [lastOverdueViewedTimestamp]); // Depende de lastOverdueViewedTimestamp

  // Función para obtener el conteo de nuevas tareas (filtrado por última revisión)
  const calculateNewTasksCount = useCallback(async () => {
    try {
      const response = await fetch('/api/tasks/newly-created');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Filtrar solo las tareas que fueron creadas *después* de la última vez que se revisó
      const newNewTasks = data.filter(task => {
        const taskCreationDate = new Date(task.fecha_creacion).getTime();
        return taskCreationDate > lastNewTasksViewedTimestamp;
      });
      setNewTasksCount(newNewTasks.length);
    } catch (error) {
      console.error("Error al obtener el conteo de nuevas tareas:", error);
      setNewTasksCount(0); // Resetear conteo en caso de error
    }
  }, [lastNewTasksViewedTimestamp]); // Depende de lastNewTasksViewedTimestamp


  // useEffect para cargar tareas y conteos de notificaciones al inicio
  useEffect(() => {
    fetchTasks();
    // Los conteos se calcularán cuando lastOverdueViewedTimestamp y lastNewTasksViewedTimestamp se inicialicen
  }, []);

  // useEffect para recalcular los conteos cuando las tareas cambian o los timestamps de vista cambian
  useEffect(() => {
    calculateOverdueCount();
    calculateNewTasksCount();
  }, [tasks, calculateOverdueCount, calculateNewTasksCount]); // Depende de tasks y las funciones memoizadas


  // Función para manejar el cambio de página
  const handleNavigation = (page) => {
    setCurrentPage(page);
    // Limpiar mensajes y tareas seleccionadas/editadas al cambiar de página
    setFormMessage(null);
    setDependencyMessage(null); // Limpiar mensajes de dependencia
    setHistoryError(null); // Limpiar mensajes de historial
    // Cerrar cualquier alerta abierta al cambiar de página principal
    setShowOverdueAlert(false);
    setShowNewTasksAlert(false);

    if (page !== 'taskDetails') {
      setSelectedTask(null);
      setEditedTask(null);
    }
    if (page !== 'dependencies') {
        setDependencyTask('');
        setParentTaskForDependency('');
        setTaskChildren([]);
    }
    if (page !== 'history') {
        setSelectedTaskForHistory('');
        setTaskHistory([]);
    }
  };

  // Manejador de cambios para los campos del formulario de nueva tarea
  const handleNewTaskChange = (e) => {
    const { name, value } = e.target;
    setNewTask((prevTask) => ({
      ...prevTask,
      [name]: value,
    }));
  };

  // Manejador de envío del formulario de nueva tarea
  const handleNewTaskSubmit = async (e) => {
    e.preventDefault();
    setFormMessage(null);

    if (!newTask.titulo || !newTask.fecha_limite || !newTask.prioridad || !newTask.estado || !newTask.categoria) {
      setFormMessage({ type: 'error', text: 'Por favor, complete todos los campos obligatorios (Título, Fecha Límite, Prioridad, Estado, Categoría).' });
      return;
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTask),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const addedTask = await response.json();
      setFormMessage({ type: 'success', text: `Tarea "${addedTask.task.titulo}" creada con éxito!` });
      setNewTask({ // Limpiar el formulario
        titulo: '',
        descripcion: '',
        fecha_limite: '',
        prioridad: 'Media',
        estado: 'Pendiente',
        categoria: '',
        tarea_padre_id: null,
      });
      fetchTasks(); // Volver a cargar las tareas (esto disparará la actualización de conteos)
    } catch (error) {
      console.error("Error al crear la tarea:", error);
      setFormMessage({ type: 'error', text: `Error al crear la tarea: ${error.message}` });
    }
  };

  // Al seleccionar una tarea para ver/editar
  const handleSelectTaskForEdit = (task) => {
    setSelectedTask(task);
    // Pre-rellenar el formulario de edición con los datos de la tarea
    setEditedTask({
      ...task,
      fecha_limite: task.fecha_limite ? new Date(task.fecha_limite).toISOString().split('T')[0] : '', // Formato YYYY-MM-DD
      id_tarea_padre: task.id_tarea_padre || '', // Asegurar que sea string vacío si es null
    });
    handleNavigation('taskDetails');
  };

  // Manejador de cambios para los campos del formulario de edición de tarea
  const handleEditTaskChange = (e) => {
    const { name, value } = e.target;
    setEditedTask((prevTask) => ({
      ...prevTask,
      [name]: value,
    }));
  };

  // Manejador para actualizar una tarea existente
  const handleUpdateTask = async (e) => {
    e.preventDefault();
    setFormMessage(null);

    if (!editedTask.titulo || !editedTask.fecha_limite || !editedTask.prioridad || !editedTask.estado || !editedTask.categoria) {
      setFormMessage({ type: 'error', text: 'Por favor, complete todos los campos obligatorios para actualizar la tarea.' });
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${editedTask.id_tarea}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedTask),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const updatedTask = await response.json();
      setFormMessage({ type: 'success', text: `Tarea "${editedTask.titulo}" (ID: ${updatedTask.id_tarea}) actualizada con éxito!` }); // Mensaje más claro
      fetchTasks(); // Volver a cargar las tareas para reflejar los cambios (disparará actualización de conteos)
      setSelectedTask(updatedTask); // Actualizar la tarea seleccionada con los nuevos datos
    } catch (error) {
      console.error("Error al actualizar la tarea:", error);
      setFormMessage({ type: 'error', text: `Error al actualizar la tarea: ${error.message}` });
    }
  };

  // Manejador para eliminar una tarea
  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la tarea "${taskTitle}" (ID: ${taskId})?`)) {
      return; // Si el usuario cancela, no hacer nada
    }
    setFormMessage(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      setFormMessage({ type: 'success', text: `Tarea "${taskTitle}" eliminada con éxito.` });
      fetchTasks(); // Volver a cargar las tareas para actualizar la lista (disparará actualización de conteos)
      handleNavigation('allTasks'); // Navegar de vuelta a la lista de tareas
    } catch (error) {
      console.error("Error al eliminar la tarea:", error);
      setFormMessage({ type: 'error', text: `Error al eliminar la tarea: ${error.message}` });
    }
  };

  // Funciones para Gestión de Dependencias
  const fetchTaskChildren = async (taskId) => {
    if (!taskId) {
        setTaskChildren([]);
        return;
    }
    setDependencyMessage(null);
    try {
        const response = await fetch(`/api/tasks/${taskId}/children`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTaskChildren(data);
    } catch (error) {
        console.error("Error al obtener tareas hijas:", error);
        setDependencyMessage({ type: 'error', text: `Error al cargar dependencias: ${error.message}` });
        setTaskChildren([]);
    }
  };

  const handleSetDependency = async (e) => {
    e.preventDefault();
    setDependencyMessage(null);

    if (!dependencyTask || !parentTaskForDependency) {
        setDependencyMessage({ type: 'error', text: 'Por favor, seleccione una tarea hija y una tarea padre.' });
        return;
    }
    if (parseInt(dependencyTask) === parseInt(parentTaskForDependency)) { // Usar parseInt para comparar números
        setDependencyMessage({ type: 'error', text: 'Una tarea no puede depender de sí misma.' });
        return;
    }

    try {
        const response = await fetch(`/api/tasks/${dependencyTask}/set-parent`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ parent_task_id: parentTaskForDependency }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setDependencyMessage({ type: 'success', text: data.message });
        fetchTasks(); // Recargar todas las tareas para reflejar la nueva dependencia (disparará actualización de conteos)
        fetchTaskChildren(parentTaskForDependency); // Actualizar la lista de hijos del padre
        setDependencyTask(''); // Limpiar campos
        setParentTaskForDependency('');
    } catch (error) {
        console.error("Error al establecer la dependencia:", error);
        setDependencyMessage({ type: 'error', text: `Error al establecer la dependencia: ${error.message}` });
    }
  };

  const handleRemoveDependency = async (taskId) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la dependencia de la tarea ID ${taskId}?`)) {
        return;
    }
    setDependencyMessage(null);
    try {
        const response = await fetch(`/api/tasks/${taskId}/remove-parent`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setDependencyMessage({ type: 'success', text: data.message });
        fetchTasks(); // Recargar todas las tareas (disparará actualización de conteos)
        fetchTaskChildren(dependencyTask); // Actualizar lista de hijos si aplica
    } catch (error) {
        console.error("Error al eliminar la dependencia:", error);
        setDependencyMessage({ type: 'error', text: `Error al eliminar la dependencia: ${error.message}` });
    }
  };

  // Funciones para Historial de Tareas
  const fetchTaskHistory = async (taskId) => {
    if (!taskId) {
        setTaskHistory([]);
        return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
        const response = await fetch(`/api/tasks/${taskId}/history`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTaskHistory(data);
    } catch (e) {
        console.error("Error al obtener el historial de la tarea:", e);
        setHistoryError(`Error al cargar el historial: ${e.message}`);
        setTaskHistory([]);
    } finally {
        setHistoryLoading(false);
    }
  };

  // Funciones para Alertas
  const fetchOverdueTasksAndMarkViewed = async () => {
    setAlertTitle("Tareas Vencidas");
    setAlertContent("Cargando tareas vencidas...");
    setShowOverdueAlert(true);

    // Marcar como visto AHORA
    const now = Date.now();
    localStorage.setItem('lastOverdueViewed', now.toString());
    setLastOverdueViewedTimestamp(now); // Actualizar el estado para que se recalcule el conteo

    try {
      const response = await fetch('/api/tasks/overdue');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setOverdueTasksList(data);
      if (data.length === 0) {
        setAlertContent("No hay tareas vencidas actualmente.");
      } else {
        setAlertContent(
          <ul className="list-disc list-inside">
            {data.map(task => (
              <li key={task.id_tarea}>
                ID: {task.id_tarea} - {task.titulo} (Fecha Límite: {task.fecha_limite ? new Date(task.fecha_limite).toLocaleDateString() : 'N/A'})
              </li>
            ))}
          </ul>
        );
      }
    } catch (error) {
      console.error("Error al obtener tareas vencidas:", error);
      setAlertContent(`Error al cargar tareas vencidas: ${error.message}`);
    }
  };

  const fetchNewTasksAndMarkViewed = async () => {
    setAlertTitle("Nuevas Tareas Publicadas (Últimas 24h)");
    setAlertContent("Cargando nuevas tareas...");
    setShowNewTasksAlert(true);

    // Marcar como visto AHORA
    const now = Date.now();
    localStorage.setItem('lastNewTasksViewed', now.toString());
    setLastNewTasksViewedTimestamp(now); // Actualizar el estado para que se recalcule el conteo

    try {
      const response = await fetch('/api/tasks/newly-created');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setNewTasksList(data);
      if (data.length === 0) {
        setAlertContent("No hay nuevas tareas publicadas en las últimas 24 horas.");
      } else {
        setAlertContent(
          <ul className="list-disc list-inside">
            {data.map(task => (
              <li key={task.id_tarea}>
                ID: {task.id_tarea} - {task.titulo} (Creada: {new Date(task.fecha_creacion).toLocaleDateString()})
              </li>
            ))}
          </ul>
        );
      }
    } catch (error) {
      console.error("Error al obtener nuevas tareas:", error);
      setAlertContent(`Error al cargar nuevas tareas: ${error.message}`);
    }
  };

  const closeAlertModal = () => {
    setShowOverdueAlert(false);
    setShowNewTasksAlert(false);
    setAlertTitle('');
    setAlertContent('');
    setOverdueTasksList([]);
    setNewTasksList([]);
    // IMPORTANTE: No necesitamos llamar a calculateOverdueCount/calculateNewTasksCount aquí.
    // El cambio de lastOverdueViewedTimestamp/lastNewTasksViewedTimestamp ya disparó el recalculo.
  };


  // Obtener las 5 tareas más recientes para el dashboard
  const recentTasks = tasks.slice(0, 5); // Limita a las 5 tareas más recientes

  // Calcular contadores para el dashboard
  const pendingTasksCount = tasks.filter(task => task.estado === 'Pendiente').length;
  const completedTasksCount = tasks.filter(task => task.estado === 'Completada').length;
  const inProgressTasksCount = tasks.filter(task => task.estado === 'En Proceso').length;
  const overdueTasksCount = tasks.filter(task => task.estado === 'Vencida').length; // Asumiendo que 'Vencida' es un estado

  return (
    // Main container with flex layout and overflow hidden
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
      {/* Sidebar - Main Navigation */}
      <aside className="w-64 bg-indigo-800 text-white flex flex-col rounded-r-lg shadow-lg flex-shrink-0">
        <div className="p-4 text-2xl font-bold border-b border-indigo-700">
          TaSys
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {/* Navigation Links */}
          <a
            href="#"
            onClick={() => handleNavigation('dashboard')}
            className={`flex items-center p-2 rounded-lg transition-colors duration-200 ${currentPage === 'dashboard' ? 'bg-indigo-700' : 'hover:bg-indigo-700'}`}
          >
            <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
            Dashboard
          </a>
          <div className="text-xs uppercase text-indigo-300 px-2 pt-4 pb-1">Gestión de Tareas</div>
          <a
            href="#"
            onClick={() => handleNavigation('allTasks')}
            className={`flex items-center p-2 rounded-lg transition-colors duration-200 ${currentPage === 'allTasks' ? 'bg-indigo-700' : 'hover:bg-indigo-700'}`}
          >
            <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1H7zM7 7a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1V8a1 1 0 00-1-1H7zM7 11a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1v-1a1 1 0 00-1-1H7zM7 15a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1v-1a1 1 0 00-1-1H7zM11 3a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2zM11 7a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1V8a1 1 0 00-1-1h-2zM11 11a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1v-1a1 1 0 00-1-1h-2zM11 15a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1v-1a1 1 0 00-1-1h-2zM15 3a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2zM15 7a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1V8a1 1 0 00-1-1h-2zM15 11a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1v-1a1 1 0 00-1-1h-2zM15 15a1 1 0 00-1 1v1a1 1 0 001 1h2a1 1 0 001-1v-1a1 1 0 00-1-1h-2z"></path></svg>
            Todas las Tareas
          </a>
          <a
            href="#"
            onClick={() => handleNavigation('createTask')}
            className={`flex items-center p-2 rounded-lg transition-colors duration-200 ${currentPage === 'createTask' ? 'bg-indigo-700' : 'hover:bg-indigo-700'}`}
          >
            <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"></path></svg>
            Crear Nueva Tarea
          </a>
          <a
            href="#"
            onClick={() => handleNavigation('dependencies')}
            className={`flex items-center p-2 rounded-lg transition-colors duration-200 ${currentPage === 'dependencies' ? 'bg-indigo-700' : 'hover:bg-indigo-700'}`}
          >
            <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 100 2h2a1 1 0 100-2h-2zM10 7a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H7a1 1 0 110-2h2V8a1 1 0 011-1z"></path></svg>
            Gestión de Dependencias
          </a>
          <a
            href="#"
            onClick={() => handleNavigation('history')}
            className={`flex items-center p-2 rounded-lg transition-colors duration-200 ${currentPage === 'history' ? 'bg-indigo-700' : 'hover:bg-indigo-700'}`}
          >
            <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20"><path d="M12 6V4a2 2 0 00-2-2H6a2 2 0 00-2 2v2m0 5a2 2 0 002 2h2m4-2a2 2 0 002-2V7a2 2 0 00-2-2h-2m-4 5a2 2 0 002 2h2m0 0a2 2 0 002 2h2m-4-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2m0 0a2 2 0 002 2h2m0 0a2 2 0 002 2h2m0 0a2 2 0 002 2h2"></path></svg>
            Historial de Tareas
          </a>
        </nav>
      </aside>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navbar - Barra Superior */}
        <header className="bg-white shadow-md p-4 flex items-center justify-end rounded-bl-lg flex-shrink-0">
          <div className="flex items-center space-x-4">
            {/* Botón de Campana (Alertas de Tareas Vencidas) */}
            <div className="relative">
              <button
                className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
                onClick={fetchOverdueTasksAndMarkViewed} // Cambiado a la nueva función
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path></svg>
              </button>
              {overdueCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
                  {overdueCount}
                </span>
              )}
            </div>
            {/* Botón de Sobre (Alertas de Nuevas Tareas) */}
            <div className="relative">
              <button
                className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
                onClick={fetchNewTasksAndMarkViewed} // Cambiado a la nueva función
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
              </button>
              {newTasksCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-blue-100 bg-blue-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
                  {newTasksCount}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Contenido Principal del Dashboard (Secciones Condicionales) */}
        <main className="flex-1 p-6 overflow-y-auto">

          {/* Dashboard Principal */}
          {currentPage === 'dashboard' && (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>
              {/* Sección de Estadísticas (Cards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-blue-500">Tareas Pendientes</div>
                    <div className="text-2xl font-bold text-gray-800">{pendingTasksCount}</div>
                  </div>
                  <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 12H4V6h12v10z"></path></svg>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-green-500">Tareas Completadas</div>
                    <div className="text-2xl font-bold text-gray-800">{completedTasksCount}</div>
                  </div>
                  <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zM4 4h12v12H4V4z"></path></svg>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-yellow-500">Tareas en Proceso</div>
                    <div className="text-2xl font-bold text-gray-800">{inProgressTasksCount}</div>
                  </div>
                  <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 00-.894.553L7.382 4H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-3.382l-.724-1.447A1 1 0 0011 2H9z"></path></svg>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-red-500">Tareas Vencidas</div>
                    <div className="text-2xl font-bold text-gray-800">{overdueTasksCount}</div>
                  </div>
                  <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path></svg>
                </div>
              </div>

              {/* Sección: Tareas Más Recientes */}
              <section className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Tareas Más Recientes</h2>
                {loading && <p className="text-center text-gray-600">Cargando tareas...</p>}
                {error && <p className="text-center text-red-500">{error}</p>}
                {!loading && !error && recentTasks.length === 0 && (
                  <p className="text-center text-gray-600">No hay tareas recientes para mostrar.</p>
                )}
                {!loading && !error && recentTasks.length > 0 && (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full table-fixed bg-white rounded-lg shadow-md">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold rounded-tl-lg w-1/12">ID</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-3/12">Título</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-2/12">Categoría</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-1/12">Prioridad</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-1/12">Estado</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-2/12">Fecha Límite</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold rounded-tr-lg w-1/12">Tarea Padre</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-1/12">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTasks.map((task) => (
                          <tr key={task.id_tarea} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-2 px-4">{task.id_tarea}</td>
                            <td className="py-2 px-4 font-medium">{task.titulo}</td>
                            <td className="py-2 px-4">{task.categoria}</td>
                            <td className="py-2 px-4">{task.prioridad}</td>
                            <td className="py-2 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                ${task.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' : ''}
                                ${task.estado === 'En Proceso' ? 'bg-blue-100 text-blue-800' : ''}
                                ${task.estado === 'Completada' ? 'bg-green-100 text-green-800' : ''}
                                ${task.estado === 'Vencida' ? 'bg-red-100 text-red-800' : ''}
                              `}>
                                {task.estado}
                              </span>
                            </td>
                            <td className="py-2 px-4">{task.fecha_limite ? new Date(task.fecha_limite).toLocaleDateString() : 'N/A'}</td>
                            <td className="py-2 px-4">{task.tarea_padre_titulo || 'N/A'}</td>
                            <td className="py-2 px-4 flex space-x-2">
                              <button
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
                                onClick={() => handleSelectTaskForEdit(task)}
                              >
                                Ver/Editar
                              </button>
                              <button
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
                                onClick={() => handleDeleteTask(task.id_tarea, task.titulo)}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* Sección: Todas las Tareas */}
          {currentPage === 'allTasks' && (
            <section className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Todas las Tareas</h2>
              {loading && <p className="text-center text-gray-600">Cargando tareas...</p>}
              {error && <p className="text-center text-red-500">{error}</p>}
              {!loading && !error && tasks.length === 0 && (
                <p className="text-center text-gray-600">No hay tareas para mostrar. ¡Crea una!</p>
              )}
              {!loading && !error && tasks.length > 0 && (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full table-fixed bg-white rounded-lg shadow-md">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold rounded-tl-lg w-1/12">ID</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-3/12">Título</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-2/12">Categoría</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-1/12">Prioridad</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-1/12">Estado</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-2/12">Fecha Límite</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold rounded-tr-lg w-1/12">Tarea Padre</th>
                          <th className="py-2 px-4 text-left text-gray-600 font-semibold w-1/12">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => (
                          <tr key={task.id_tarea} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-2 px-4">{task.id_tarea}</td>
                            <td className="py-2 px-4 font-medium">{task.titulo}</td>
                            <td className="py-2 px-4">{task.categoria}</td>
                            <td className="py-2 px-4">{task.prioridad}</td>
                            <td className="py-2 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                ${task.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' : ''}
                                ${task.estado === 'En Proceso' ? 'bg-blue-100 text-blue-800' : ''}
                                ${task.estado === 'Completada' ? 'bg-green-100 text-green-800' : ''}
                                ${task.estado === 'Vencida' ? 'bg-red-100 text-red-800' : ''}
                              `}>
                                {task.estado}
                              </span>
                            </td>
                            <td className="py-2 px-4">{task.fecha_limite ? new Date(task.fecha_limite).toLocaleDateString() : 'N/A'}</td>
                            <td className="py-2 px-4">{task.tarea_padre_titulo || 'N/A'}</td>
                            <td className="py-2 px-4 flex space-x-2">
                              <button
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
                                onClick={() => handleSelectTaskForEdit(task)}
                              >
                                Ver/Editar
                              </button>
                              <button
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
                                onClick={() => handleDeleteTask(task.id_tarea, task.titulo)}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>
          )}

          {/* Sección: Crear Nueva Tarea */}
          {currentPage === 'createTask' && (
            <section className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Crear Nueva Tarea</h2>
              <p className="text-gray-600">Formulario para añadir nuevas tareas a la base de datos.</p>
              <form onSubmit={handleNewTaskSubmit} className="space-y-4">
                <div>
                  <label htmlFor="titulo" className="block text-sm font-medium text-gray-700">Título <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="titulo"
                    name="titulo"
                    value={newTask.titulo}
                    onChange={handleNewTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">Descripción</label>
                  <textarea
                    id="descripcion"
                    name="descripcion"
                    value={newTask.descripcion}
                    onChange={handleNewTaskChange}
                    rows="3"
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="fecha_limite" className="block text-sm font-medium text-gray-700">Fecha Límite <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    id="fecha_limite"
                    name="fecha_limite"
                    value={newTask.fecha_limite}
                    onChange={handleNewTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="prioridad" className="block text-sm font-medium text-gray-700">Prioridad <span className="text-red-500">*</span></label>
                  <select
                    id="prioridad"
                    name="prioridad"
                    value={newTask.prioridad}
                    onChange={handleNewTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="estado" className="block text-sm font-medium text-gray-700">Estado <span className="text-red-500">*</span></label>
                  <select
                    id="estado"
                    name="estado"
                    value={newTask.estado}
                    onChange={handleNewTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Completada">Completada</option>
                    <option value="Vencida">Vencida</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="categoria" className="block text-sm font-medium text-gray-700">Categoría <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="categoria"
                    name="categoria"
                    value={newTask.categoria}
                    onChange={handleNewTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tarea_padre_id" className="block text-sm font-medium text-gray-700">ID Tarea Padre (opcional)</label>
                  <input
                    type="number"
                    id="tarea_padre_id"
                    name="tarea_padre_id"
                    value={newTask.tarea_padre_id || ''}
                    onChange={handleNewTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                  />
                </div>

                {formMessage && (
                  <div className={`p-3 rounded-md ${formMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {formMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Crear Tarea
                </button>
              </form>
            </section>
          )}

          {/* Sección: Detalles y Edición de Tarea Seleccionada */}
          {currentPage === 'taskDetails' && selectedTask && (
            <section className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Detalles y Edición de Tarea: {selectedTask.titulo}</h2>
              <p className="text-gray-600 mb-4">Modifica los campos y haz clic en "Actualizar Tarea".</p>

              <form onSubmit={handleUpdateTask} className="space-y-4">
                <div>
                  <label htmlFor="edit_titulo" className="block text-sm font-medium text-gray-700">Título <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="edit_titulo"
                    name="titulo"
                    value={editedTask.titulo}
                    onChange={handleEditTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit_descripcion" className="block text-sm font-medium text-gray-700">Descripción</label>
                  <textarea
                    id="edit_descripcion"
                    name="descripcion"
                    value={editedTask.descripcion || ''}
                    onChange={handleEditTaskChange}
                    rows="3"
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="edit_fecha_limite" className="block text-sm font-medium text-gray-700">Fecha Límite <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    id="edit_fecha_limite"
                    name="fecha_limite"
                    value={editedTask.fecha_limite}
                    onChange={handleEditTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit_prioridad" className="block text-sm font-medium text-gray-700">Prioridad <span className="text-red-500">*</span></label>
                  <select
                    id="edit_prioridad"
                    name="prioridad"
                    value={editedTask.prioridad}
                    onChange={handleEditTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit_estado" className="block text-sm font-medium text-gray-700">Estado <span className="text-red-500">*</span></label>
                  <select
                    id="edit_estado"
                    name="estado"
                    value={editedTask.estado}
                    onChange={handleEditTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Completada">Completada</option>
                    <option value="Vencida">Vencida</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit_categoria" className="block text-sm font-medium text-gray-700">Categoría <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="edit_categoria"
                    name="categoria"
                    value={editedTask.categoria}
                    onChange={handleEditTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit_id_tarea_padre" className="block text-sm font-medium text-gray-700">ID Tarea Padre (opcional)</label>
                  <input
                    type="number"
                    id="edit_id_tarea_padre"
                    name="id_tarea_padre"
                    value={editedTask.id_tarea_padre || ''}
                    onChange={handleEditTaskChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                  />
                </div>

                {formMessage && (
                  <div className={`p-3 rounded-md ${formMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {formMessage.text}
                  </div>
                )}

                <div className="flex space-x-4 mt-6">
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Actualizar Tarea
                  </button>
                  <button
                    type="button" // Importante: type="button" para no enviar el formulario
                    className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={() => {
                      setSelectedTask(null);
                      setEditedTask(null);
                      handleNavigation('allTasks'); // Volver a la lista de tareas
                    }}
                  >
                    Volver a Tareas
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Sección: Gestión de Dependencias */}
          {currentPage === 'dependencies' && (
            <section className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Gestión de Dependencias</h2>
              <p className="text-gray-600 mb-4">Establece o elimina relaciones de dependencia entre tareas (Tarea Hija depende de Tarea Padre).</p>

              <form onSubmit={handleSetDependency} className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="dependency_task" className="block text-sm font-medium text-gray-700">Tarea Hija (ID) <span className="text-red-500">*</span></label>
                        <select
                            id="dependency_task"
                            name="dependency_task"
                            value={dependencyTask}
                            onChange={(e) => {
                                setDependencyTask(e.target.value);
                                setTaskChildren([]); // Limpiar hijos al cambiar tarea hija
                            }}
                            className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                            required
                        >
                            <option value="">Selecciona Tarea Hija</option>
                            {tasks.map(task => (
                                <option key={task.id_tarea} value={task.id_tarea}>
                                    {task.id_tarea} - {task.titulo}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="parent_task_for_dependency" className="block text-sm font-medium text-gray-700">Tarea Padre (ID) <span className="text-red-500">*</span></label>
                        <select
                            id="parent_task_for_dependency"
                            name="parent_task_for_dependency"
                            value={parentTaskForDependency}
                            onChange={(e) => setParentTaskForDependency(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                            required
                        >
                            <option value="">Selecciona Tarea Padre</option>
                            {tasks.map(task => (
                                <option key={task.id_tarea} value={task.id_tarea}>
                                    {task.id_tarea} - {task.titulo}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {dependencyMessage && (
                  <div className={`p-3 rounded-md ${dependencyMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {dependencyMessage.text}
                  </div>
                )}

                <div className="flex space-x-4">
                    <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Establecer Dependencia
                    </button>
                    <button
                        type="button"
                        onClick={() => handleRemoveDependency(dependencyTask)}
                        className="inline-flex justify-center py-2 px-4 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        disabled={!dependencyTask}
                    >
                        Eliminar Dependencia de Tarea Hija Seleccionada
                    </button>
                </div>
              </form>

              <h3 className="text-xl font-bold text-gray-800 mb-3 mt-6">Ver Dependencias de una Tarea Padre</h3>
              <div className="flex items-center space-x-2 mb-4">
                <select
                    value={dependencyTask}
                    onChange={(e) => {
                        setDependencyTask(e.target.value);
                        fetchTaskChildren(e.target.value);
                    }}
                    className="mt-1 block w-full md:w-1/2 rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                >
                    <option value="">Selecciona Tarea Padre para ver hijos</option>
                    {tasks.map(task => (
                        <option key={task.id_tarea} value={task.id_tarea}>
                            {task.id_tarea} - {task.titulo}
                        </option>
                    ))}
                </select>
              </div>

              {dependencyTask && taskChildren.length > 0 && (
                <div>
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Tareas que dependen de ID {dependencyTask}:</h4>
                    <ul className="list-disc list-inside bg-gray-50 p-4 rounded-md border border-gray-200">
                        {taskChildren.map(child => (
                            <li key={child.id_tarea} className="text-gray-700">
                                ID: {child.id_tarea} - Título: {child.titulo} (Estado: {child.estado})
                            </li>
                        ))}
                    </ul>
                </div>
              )}
              {dependencyTask && !loading && taskChildren.length === 0 && (
                <p className="text-gray-600">No hay tareas que dependan de la tarea ID {dependencyTask}.</p>
              )}


            </section>
          )}

          {/* Sección: Historial de Tareas */}
          {currentPage === 'history' && (
            <section className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Historial de Tareas</h2>
              <p className="text-gray-600 mb-4">Selecciona una tarea para ver su historial de cambios.</p>

              <div className="mb-4">
                <label htmlFor="select_task_for_history" className="block text-sm font-medium text-gray-700">Selecciona Tarea (ID)</label>
                <select
                    id="select_task_for_history"
                    name="select_task_for_history"
                    value={selectedTaskForHistory}
                    onChange={(e) => {
                        setSelectedTaskForHistory(e.target.value);
                        fetchTaskHistory(e.target.value);
                    }}
                    className="mt-1 block w-full md:w-1/2 rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-white text-gray-900"
                >
                    <option value="">Selecciona una tarea</option>
                    {tasks.map(task => (
                        <option key={task.id_tarea} value={task.id_tarea}>
                            {task.id_tarea} - {task.titulo}
                        </option>
                    ))}
                </select>
              </div>

              {historyLoading && <p className="text-center text-gray-600">Cargando historial...</p>}
              {historyError && <p className="text-center text-red-500">{historyError}</p>}

              {!historyLoading && !historyError && selectedTaskForHistory && taskHistory.length === 0 && (
                <p className="text-gray-600">No hay historial de cambios para la tarea ID {selectedTaskForHistory}.</p>
              )}

              {!historyLoading && !historyError && selectedTaskForHistory && taskHistory.length > 0 && (
                <div className="overflow-x-auto w-full">
                  <table className="w-full table-auto bg-white rounded-lg shadow-md text-sm">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="py-2 px-4 text-left text-gray-600 font-semibold rounded-tl-lg">ID Historial</th>
                        <th className="py-2 px-4 text-left text-gray-600 font-semibold">Campo Modificado</th>
                        <th className="py-2 px-4 text-left text-gray-600 font-semibold">Valor Anterior</th>
                        <th className="py-2 px-4 text-left text-gray-600 font-semibold">Valor Nuevo</th>
                        <th className="py-2 px-4 text-left text-gray-600 font-semibold">Fecha Cambio</th>
                        <th className="py-2 px-4 text-left text-gray-600 font-semibold rounded-tr-lg">Usuario Cambio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskHistory.map((entry) => (
                        <tr key={entry.id_historial} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-2 px-4">{entry.id_historial}</td>
                          <td className="py-2 px-4">{entry.campo_modificado}</td>
                          <td className="py-2 px-4">{entry.valor_anterior || 'N/A'}</td>
                          <td className="py-2 px-4">{entry.valor_nuevo || 'N/A'}</td>
                          <td className="py-2 px-4">{new Date(entry.fecha_cambio).toLocaleString()}</td>
                          <td className="py-2 px-4">{entry.usuario_cambio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Modal de Alerta Personalizado */}
          {(showOverdueAlert || showNewTasksAlert) && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                <h3 className="text-xl font-bold text-gray-800 mb-4">{alertTitle}</h3>
                <div className="text-gray-700 mb-6">
                  {alertContent}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={closeAlertModal}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
