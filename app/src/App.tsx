import { KanbanBoard } from '@/features/board';
import { AuthGate } from '@/features/auth/AuthGate';
import { TracePanel } from '@/features/observability/TracePanel';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <AuthGate>
        <KanbanBoard />
      </AuthGate>
      {import.meta.env.DEV && <TracePanel />}
    </div>
  );
}
