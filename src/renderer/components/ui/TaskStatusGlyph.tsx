import { Map, FastForward, PencilLine, Shield, Zap } from 'lucide-react';
import type { ActivityInfo, ActivityState, PermissionMode } from '../../../shared/types';
import { Tooltip } from './Tooltip';

/**
 * Single per-task indicator that unifies two signals:
 *   • SHAPE  = Claude's permission mode (plan / auto / accept-edits / confirm / yolo)
 *   • COLOR  = activity state (busy / waiting / done-unseen / idle / error)
 *   • PULSE  = animates while busy or waiting for you
 *
 * Replaces the old plain status dot. Attention ("this task wants you") is carried
 * separately by bold task-name text, so this glyph never gets overloaded.
 */

const MODE_ICON: Record<PermissionMode, typeof Shield> = {
  plan: Map,
  auto: FastForward,
  acceptEdits: PencilLine,
  dontAsk: Zap,
  bypassPermissions: Zap,
  default: Shield,
};

const MODE_LABEL: Record<PermissionMode, string> = {
  plan: 'Plan',
  auto: 'Auto',
  acceptEdits: 'Auto-edit',
  dontAsk: 'Yolo',
  bypassPermissions: 'Yolo',
  default: 'Confirm',
};

function stateColorClass(state: ActivityState): string {
  switch (state) {
    case 'error':
      return 'text-destructive';
    case 'waiting':
      return 'text-orange-500';
    case 'busy':
      return 'text-amber-400';
    case 'idle':
      return 'text-blue-400';
  }
}

function stateLabel(info: ActivityInfo): string {
  switch (info.state) {
    case 'error':
      switch (info.error?.type) {
        case 'rate_limit':
          return 'Rate limited';
        case 'auth_error':
          return 'Authentication error';
        case 'billing_error':
          return 'Billing error';
        default:
          return 'Error';
      }
    case 'waiting':
      return 'Waiting for you';
    case 'busy':
      return info.compacting ? 'Compacting context…' : (info.tool?.label ?? 'Claude is working');
    case 'idle':
      return 'Idle';
  }
}

export function TaskStatusGlyph({
  info,
  size = 12,
}: {
  info: ActivityInfo | undefined;
  size?: number;
}) {
  // No activity yet (task not started) → render nothing, matching the old dot.
  if (!info) return null;

  const mode = info.permissionMode ?? 'default';
  const Icon = MODE_ICON[mode] ?? Shield;
  const color = stateColorClass(info.state);
  // Pulse ONLY while actively working. Idle / done / waiting are not "in
  // progress", so they stay still — attention for waiting/done is carried by
  // the bold task name instead.
  const pulse = info.state === 'busy' ? 'glyph-pulse' : '';
  const tooltip = `${stateLabel(info)} · ${MODE_LABEL[mode]} mode`;

  return (
    <Tooltip content={tooltip}>
      <Icon
        size={size}
        strokeWidth={2}
        className={`flex-shrink-0 ${color} ${pulse}`}
      />
    </Tooltip>
  );
}
