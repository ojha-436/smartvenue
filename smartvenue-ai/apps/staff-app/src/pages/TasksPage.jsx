import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckCircle, Clock, X, RefreshCw } from 'lucide-react';

const STAFF_API = import.meta.env.VITE_STAFF_API;

const priorityColor = { high: 'text-red-600 bg-red-50', medium: 'text-orange-600 bg-orange-50', low: 'text-gray-600 bg-gray-100' };

export default function TasksPage({ token, venueId }) {
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = () => {
    setLoading(true);
    axios.get(`${STAFF_API}/api/staff/tasks?venueId=${venueId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => setTasks(r.data.tasks || []))
      .catch(() => toast.error('Could not load tasks'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchTasks, [venueId, token]);

  const updateTask = async (taskId, status) => {
    try {
      await axios.put(`${STAFF_API}/api/staff/tasks/${taskId}`, { venueId, status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(ts => ts.map(t => t.taskId === taskId ? { ...t, status } : t));
      toast.success(`Task ${status}`);
    } catch { toast.error('Could not update task'); }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">My Tasks</h2>
        <button onClick={fetchTasks} className="text-green-600 hover:text-green-700">
          <RefreshCw size={18} />
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="text-center py-10">
          <CheckCircle size={40} className="text-green-400 mx-auto mb-2" />
          <p className="text-gray-500">No pending tasks. All clear!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.taskId} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityColor[task.priority] || priorityColor.medium}`}>
                      {task.priority}
                    </span>
                    {task.zoneId && (
                      <span className="text-xs text-gray-400">Zone: {task.zoneId}</span>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-gray-800">{task.title}</p>
                  {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                <Clock size={11} />
                {task.createdAt ? new Date(task.createdAt).toLocaleTimeString() : 'Just now'}
              </div>

              {task.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => updateTask(task.taskId, 'in_progress')}
                    className="flex-1 bg-blue-600 text-white text-sm font-medium rounded-xl py-2 hover:bg-blue-700">
                    Start
                  </button>
                  <button onClick={() => updateTask(task.taskId, 'rejected')}
                    className="px-4 border border-gray-200 text-gray-600 text-sm rounded-xl py-2 hover:bg-gray-50">
                    <X size={14} />
                  </button>
                </div>
              )}

              {task.status === 'in_progress' && (
                <button onClick={() => updateTask(task.taskId, 'completed')}
                  className="w-full bg-green-600 text-white text-sm font-medium rounded-xl py-2 flex items-center justify-center gap-2 hover:bg-green-700">
                  <CheckCircle size={14} /> Mark Complete
                </button>
              )}

              {['completed','rejected'].includes(task.status) && (
                <p className={`text-xs font-medium text-center py-1 rounded-lg
                  ${task.status === 'completed' ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                  {task.status === 'completed' ? '✓ Completed' : 'Rejected'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
