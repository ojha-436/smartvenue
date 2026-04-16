import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckCircle, Clock, X, RefreshCw } from 'lucide-react';

const STAFF_API = import.meta.env.VITE_STAFF_API;

/**
 * Memoized priority color mapping
 */
const PRIORITY_COLORS = {
  high: 'text-red-600 bg-red-50',
  medium: 'text-orange-600 bg-orange-50',
  low: 'text-gray-600 bg-gray-100',
};

/**
 * TasksPage - Staff task management interface
 * Displays assigned tasks with priority, status, and action buttons
 */
export default function TasksPage({ token, venueId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch tasks from API
   */
  const fetchTasks = useCallback(() => {
    setLoading(true);
    axios
      .get(`${STAFF_API}/api/staff/tasks?venueId=${venueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(r => setTasks(r.data.tasks || []))
      .catch(() => toast.error('Could not load tasks'))
      .finally(() => setLoading(false));
  }, [venueId, token]);

  // Load tasks on mount and when dependencies change
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  /**
   * Update task status
   */
  const updateTask = useCallback(
    async (taskId, status) => {
      try {
        await axios.put(
          `${STAFF_API}/api/staff/tasks/${taskId}`,
          { venueId, status },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTasks(ts => ts.map(t => (t.taskId === taskId ? { ...t, status } : t)));
        toast.success(`Task ${status === 'completed' ? 'completed' : status}`);
      } catch {
        toast.error('Could not update task');
      }
    },
    [venueId, token]
  );

  /**
   * Format timestamp for display
   */
  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp).toLocaleTimeString();
  }, []);

  /**
   * Get appropriate action buttons based on task status
   */
  const getTaskActions = useCallback(
    (task) => {
      if (task.status === 'pending') {
        return (
          <div className="flex gap-2">
            <button
              onClick={() => updateTask(task.taskId, 'in_progress')}
              className="flex-1 bg-blue-600 text-white text-sm font-medium rounded-xl py-2 hover:bg-blue-700 transition-colors"
              aria-label={`Start task: ${task.title}`}
            >
              Start
            </button>
            <button
              onClick={() => updateTask(task.taskId, 'rejected')}
              className="px-4 border border-gray-200 text-gray-600 text-sm rounded-xl py-2 hover:bg-gray-50 transition-colors"
              aria-label={`Reject task: ${task.title}`}
              title="Reject this task"
            >
              <X size={14} />
            </button>
          </div>
        );
      }

      if (task.status === 'in_progress') {
        return (
          <button
            onClick={() => updateTask(task.taskId, 'completed')}
            className="w-full bg-green-600 text-white text-sm font-medium rounded-xl py-2 flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
            aria-label={`Mark task as complete: ${task.title}`}
          >
            <CheckCircle size={14} aria-hidden="true" /> Mark Complete
          </button>
        );
      }

      return (
        <p
          className={`text-xs font-medium text-center py-1 rounded-lg
          ${
            task.status === 'completed'
              ? 'text-green-600 bg-green-50'
              : 'text-gray-500 bg-gray-100'
          }`}
        >
          {task.status === 'completed' ? '✓ Completed' : 'Rejected'}
        </p>
      );
    },
    [updateTask]
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">My Tasks</h2>
        <button
          onClick={fetchTasks}
          disabled={loading}
          className="text-green-600 hover:text-green-700 disabled:opacity-50 transition-colors"
          aria-label="Refresh tasks"
          aria-busy={loading}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <p className="text-center text-gray-400 py-10" role="status" aria-live="polite">
          Loading tasks…
        </p>
      )}

      {/* Empty state */}
      {!loading && tasks.length === 0 && (
        <div className="text-center py-10">
          <CheckCircle size={40} className="text-green-400 mx-auto mb-2" aria-hidden="true" />
          <p className="text-gray-500">No pending tasks. All clear!</p>
        </div>
      )}

      {/* Tasks list with aria-live for dynamic updates */}
      {!loading && tasks.length > 0 && (
        <div className="space-y-3" role="region" aria-live="polite" aria-label="Task list">
          {tasks.map(task => (
            <article
              key={task.taskId}
              className="bg-white rounded-2xl shadow-sm p-4"
              role="article"
              aria-label={`Task: ${task.title}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium
                      }`}
                      aria-label={`Priority: ${task.priority}`}
                    >
                      {task.priority}
                    </span>
                    {task.zoneId && (
                      <span className="text-xs text-gray-400" aria-label="Zone">
                        Zone: {task.zoneId}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-gray-800">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                <Clock size={11} aria-hidden="true" />
                <span aria-label="Task created at">
                  {formatTime(task.createdAt)}
                </span>
              </div>

              {/* Action buttons */}
              <div role="group" aria-label={`Actions for task: ${task.title}`}>
                {getTaskActions(task)}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
