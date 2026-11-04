import { View } from 'react-native';
import type { WorkerSnapshot } from '../workers';
import { Row, Section } from './kit';

/** Only fixed safe descriptions and structured identities: never goal/output/reasoning text. */
export function WorkerPanel({ bot, snapshot, now = Date.now(), focus }: {
  bot: { name: string; profile: string }; snapshot: WorkerSnapshot; now?: number; focus?: string;
}) {
  const availability = snapshot.capability === 'disabled' ? 'Worker observation is disabled on the bridge.'
    : snapshot.capability === 'unavailable' ? 'Worker status unavailable. Any records below are last observed, not live.'
    : 'Last recorded asynchronous children. Live activity and parent review are unknown.';
  return <Section title="Workers" footer={`${availability} Killed-app notifications blocked.${snapshot.hasMore ? ' History truncated by server.' : ''}`}>
    <Row title={`${bot.name} · parent bot`} detail={`Profile ${bot.profile} · parent turn and child lifetimes are separate`} />
    {snapshot.workers.map((w) => {
      // The shared Row caps detail at two lines; the previous single-detail
      // layout clipped timing, last update, review and delivery behind the
      // worker id. Split into short rows so every field is visible.
      const ended = w.completedAt ?? now / 1000;
      const elapsed = w.startedAt === null || (w.recordedState !== 'running' && w.completedAt === null)
        ? 'duration unknown' : `${Math.floor(Math.max(0, ended - w.startedAt))}s since dispatch`;
      const seen = w.updatedAt === null ? 'last update unknown' : `last ledger update ${Math.floor(Math.max(0, now / 1000 - w.updatedAt))}s ago`;
      const label = `${focus === w.id ? 'Selected · ' : ''}Child ${w.taskIndex + 1} · ${w.recordedState}`;
      const idDetail = `${w.id} · parent session ${w.parentSessionId ?? 'unknown'}`;
      return <View key={w.id}>
        <Row title={label} detail={idDetail} />
        <Row title="Timing" detail={`${elapsed} · ${seen}`} />
        <Row title="Status" detail={`live activity unknown · parent review unknown · result delivery ${w.delivery}`} />
      </View>;
    })}
    {snapshot.capability === 'ledger-v1' && !snapshot.workers.length ? <Row title="No retained asynchronous child records" detail="Not evidence that every worker is idle; synchronous workers are not covered." /> : null}
  </Section>;
}
