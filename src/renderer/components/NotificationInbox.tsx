import { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import type { Project, Task, ActivityInfo } from '../../shared/types';
import { Tooltip } from './ui/Tooltip';

interface InboxItem {
  task: Task;
  project: Project;
  state: 'waiting' | 'finished';
}

/**
 * Notification inbox: a bell + count badge that lists every task needing
 * attention across all projects — waiting on you (orange) or finished-and-unseen
 * (blue). Reads the same state the sidebar accents use, so seen/handled tasks
 * drop off automatically (opening a finished task clears its unseen flag;
 * answering a waiting task leaves the waiting state).
 */
export function NotificationInbox({
  projects,
  tasksByProject,
  taskActivity,
  unseenTaskIds,
  taskDisplayName,
  onSelectTask,
  variant = 'sidebar',
}: {
  projects: Project[];
  tasksByProject: Record<string, Task[]>;
  taskActivity: Record<string, ActivityInfo>;
  unseenTaskIds?: Set<string>;
  taskDisplayName: (task: Task) => string;
  onSelectTask: (projectId: string, taskId: string) => void;
  /** 'rail' renders a compact icon for the collapsed sidebar rail. */
  variant?: 'sidebar' | 'rail';
}) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const items = useMemo<InboxItem[]>(() => {
    const list: InboxItem[] = [];
    for (const project of projects) {
      for (const task of tasksByProject[project.id] || []) {
        if (task.archivedAt) continue;
        const st = taskActivity[task.id]?.state;
        if (st === 'waiting') list.push({ task, project, state: 'waiting' });
        else if (st === 'idle' && (unseenTaskIds?.has(task.id) ?? false))
          list.push({ task, project, state: 'finished' });
      }
    }
    // Newest first.
    list.sort((a, b) => (b.task.updatedAt || '').localeCompare(a.task.updatedAt || ''));
    return list;
  }, [projects, tasksByProject, taskActivity, unseenTaskIds]);

  const count = items.length;

  // Position the popover to the right of the button (works for both the sidebar
  // and the collapsed rail, which both hug the left edge).
  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.right + 6 });
    }
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const bellSize = variant === 'rail' ? 18 : 15;

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await window.electronAPI.resyncActivity?.();
    } finally {
      // brief spin so the action feels acknowledged even if it returns instantly
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <>
      <Tooltip content={count > 0 ? `${count} need${count === 1 ? 's' : ''} attention` : 'Notifications'}>
        <button
          ref={btnRef}
          onClick={() => setOpen((o) => !o)}
          className={`relative flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors ${
            variant === 'rail' ? 'w-9 h-9' : 'w-7 h-7'
          } ${open ? 'text-foreground bg-accent/60' : ''}`}
        >
          <Bell size={bellSize} strokeWidth={1.8} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-white text-[9px] font-semibold leading-[15px] text-center">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      </Tooltip>

      {open && pos && (
        <div
          ref={popRef}
          className="fixed z-50 w-[300px] max-h-[60vh] overflow-y-auto bg-card border border-border/60 rounded-xl shadow-2xl shadow-black/40 py-1 animate-scale-in"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground border-b border-border/40 flex items-center justify-between">
            <span>Needs attention</span>
            <Tooltip content="Re-sync all task statuses">
              <button
                onClick={refresh}
                className="p-0.5 rounded hover:bg-accent/60 hover:text-foreground transition-colors"
              >
                <RefreshCw size={12} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </Tooltip>
          </div>
          {count === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-muted-foreground/70">
              All caught up 🎉
            </div>
          ) : (
            items.map(({ task, project, state }) => (
              <button
                key={task.id}
                onClick={() => {
                  onSelectTask(project.id, task.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
              >
                <span
                  className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${
                    state === 'waiting' ? 'bg-orange-500' : 'bg-blue-400'
                  }`}
                />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[12px] text-foreground">
                    {taskDisplayName(task)}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground/70">
                    {project.name} · {state === 'waiting' ? 'waiting for you' : 'finished'}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}
