import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { RateLimits, StatusLineData, UsageThresholds } from '../../shared/types';

export function useThresholdAlerts(
  statusLineData: Record<string, StatusLineData>,
  latestRateLimits: RateLimits | undefined,
  usageThresholds: UsageThresholds,
  taskNames: Record<string, string>,
) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // NOTE: we deliberately do NOT prune fired keys when a PTY is momentarily
    // absent from statusLineData. statusLineData is replaced wholesale on every
    // push from main, so a PTY can briefly drop out (status-line gaps, resume/
    // reattach churn); pruning on absence re-armed the alert and re-fired the
    // toast every time it reappeared ("Context window at 87%" spam). The
    // hysteresis below (value < threshold*0.9) is what legitimately re-arms an
    // alert — e.g. after a /compact drops the context back down.

    const fire = (key: string, value: number, threshold: number | null, label: string) => {
      if (threshold === null || threshold <= 0) return;
      if (value < threshold * 0.9) {
        firedRef.current.delete(key);
        return;
      }
      if (value >= threshold && !firedRef.current.has(key)) {
        firedRef.current.add(key);
        toast.warning(label);
      }
    };

    // Context window is per-session, so check each PTY independently.
    for (const [ptyId, sl] of Object.entries(statusLineData)) {
      const taskName = taskNames[ptyId];
      const pct = Math.round(sl.contextUsage.percentage);
      const base = `Context window at ${pct}%`;
      fire(
        `${ptyId}:context`,
        sl.contextUsage.percentage,
        usageThresholds.contextPercentage,
        taskName ? `${taskName}: ${base}` : base,
      );
    }

    // Rate limits are account-wide. Per-PTY status-line snapshots can be
    // stale (e.g. a resumed old chat reports a stale rate_limits value),
    // so check against the most-recent snapshot only.
    const fh = latestRateLimits?.fiveHour?.usedPercentage ?? 0;
    fire(
      'global:fiveHour',
      fh,
      usageThresholds.fiveHourPercentage,
      `5-hour rate limit at ${Math.round(fh)}%`,
    );
    const sd = latestRateLimits?.sevenDay?.usedPercentage ?? 0;
    fire(
      'global:sevenDay',
      sd,
      usageThresholds.sevenDayPercentage,
      `7-day rate limit at ${Math.round(sd)}%`,
    );
  }, [statusLineData, latestRateLimits, usageThresholds, taskNames]);
}
