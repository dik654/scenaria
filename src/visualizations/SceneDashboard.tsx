import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';

export function SceneDashboard() {
  const { index: scenes } = useSceneStore();
  const { index: chars } = useCharacterStore();

  type SceneEntry = typeof scenes[0] & { characters?: string[]; estimatedMinutes?: number };

  if (scenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        씬을 추가하면 통계가 표시됩니다
      </div>
    );
  }

  // Compute stats
  const totalRuntime = scenes.reduce((sum, s) => sum + ((s as SceneEntry).estimatedMinutes ?? 2), 0);
  const intScenes = scenes.filter(s => s.interior === 'INT').length;
  const extScenes = scenes.filter(s => s.interior === 'EXT').length;
  const dayScenes = scenes.filter(s => s.timeOfDay === 'DAY').length;
  const nightScenes = scenes.filter(s => s.timeOfDay === 'NIGHT').length;

  // Location frequency
  const locationCount = new Map<string, number>();
  for (const s of scenes) {
    locationCount.set(s.location, (locationCount.get(s.location) ?? 0) + 1);
  }
  const topLocations = [...locationCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Issues
  const issueScenes = scenes.filter(s => s.hasConsistencyIssue).length;
  const foreshadowScenes = scenes.filter(s => s.hasUnresolvedForeshadowing).length;

  // Writing status
  const statusCounts = { outline: 0, draft: 0, revision: 0, done: 0, none: 0 };
  scenes.forEach(s => { if (s.status) statusCounts[s.status]++; else statusCounts.none++; });
  const statusLabels: { key: keyof typeof statusCounts; label: string; color: string }[] = [
    { key: 'done',     label: '완료',    color: '#22C55E' },
    { key: 'revision', label: '수정',    color: '#EAB308' },
    { key: 'draft',    label: '초고',    color: '#3B82F6' },
    { key: 'outline',  label: '아웃라인', color: '#6B7280' },
    { key: 'none',     label: '미설정',  color: '#374151' },
  ];

  // Act distribution
  const actBoundaries = [0, 0.25, 0.5, 0.75, 1.0];
  const actCounts = [0, 0, 0, 0];
  scenes.forEach((_, i) => {
    const pct = scenes.length > 1 ? i / (scenes.length - 1) : 0;
    for (let a = 0; a < 4; a++) {
      if (pct < actBoundaries[a + 1]) { actCounts[a]++; break; }
    }
  });
  const idealActPcts = [25, 25, 25, 25];

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="총 씬" value={scenes.length} unit="씬" />
        <StatCard label="예상 러닝타임" value={Math.round(totalRuntime)} unit="분" />
        <StatCard label="캐릭터" value={chars.length} unit="명" />
        <StatCard label="장소" value={locationCount.size} unit="곳" />
      </div>

      {/* INT/EXT */}
      <Section title="씬 유형">
        <BarChart data={[
          { label: 'INT', value: intScenes, max: scenes.length, color: '#4F46E5' },
          { label: 'EXT', value: extScenes, max: scenes.length, color: '#059669' },
          { label: 'INT/EXT', value: scenes.length - intScenes - extScenes, max: scenes.length, color: '#D97706' },
        ]} />
      </Section>

      {/* Day/Night */}
      <Section title="시간대">
        <BarChart data={[
          { label: '낮', value: dayScenes, max: scenes.length, color: '#D97706' },
          { label: '밤', value: nightScenes, max: scenes.length, color: '#4F46E5' },
          { label: '기타', value: scenes.length - dayScenes - nightScenes, max: scenes.length, color: '#6B7280' },
        ]} />
      </Section>

      {/* Act distribution */}
      <Section title="막 분포">
        <div className="space-y-1.5">
          {['1막', '2막 前', '2막 後', '3막'].map((label, i) => {
            const actual = Math.round((actCounts[i] / scenes.length) * 100);
            const ideal = idealActPcts[i];
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-xs ${Math.abs(actual - ideal) > 8 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {actCounts[i]}씬 ({actual}%)
                  </span>
                </div>
                <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="absolute h-full bg-red-700 rounded-full" style={{ width: `${actual}%` }} />
                  <div className="absolute h-full border-r-2 border-dashed border-gray-500" style={{ left: `${ideal}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-gray-700 mt-1">점선 = 이상적인 비율</p>
        </div>
      </Section>

      {/* Writing progress */}
      <Section title="작성 진행도">
        <div className="space-y-1.5">
          {/* Progress bar */}
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-800">
            {statusLabels.map(({ key, color }) =>
              statusCounts[key] > 0 ? (
                <div
                  key={key}
                  style={{ width: `${statusCounts[key] / scenes.length * 100}%`, backgroundColor: color }}
                  title={`${statusLabels.find(l => l.key === key)?.label}: ${statusCounts[key]}씬`}
                />
              ) : null
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {statusLabels.filter(({ key }) => statusCounts[key] > 0).map(({ key, label, color }) => (
              <span key={key} className="text-xs flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
                <span className="text-gray-400">{label} {statusCounts[key]}</span>
              </span>
            ))}
          </div>
          {statusCounts.done > 0 && (
            <p className="text-xs text-gray-600">
              완성률 {Math.round(statusCounts.done / scenes.length * 100)}%
            </p>
          )}
        </div>
      </Section>

      {/* Top locations */}
      <Section title="주요 장소">
        <BarChart data={topLocations.map(([loc, count], i) => ({
          label: loc,
          value: count,
          max: topLocations[0]?.[1] ?? 1,
          color: ['#DC2626', '#EA580C', '#D97706', '#059669', '#4F46E5'][i],
        }))} />
      </Section>

      {/* Issues */}
      {(issueScenes > 0 || foreshadowScenes > 0) && (
        <Section title="주의 사항">
          <div className="space-y-1">
            {issueScenes > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <span>🔴</span>
                <span>{issueScenes}개 씬에 정합성 이슈</span>
              </div>
            )}
            {foreshadowScenes > 0 && (
              <div className="flex items-center gap-2 text-xs text-yellow-400">
                <span>🟡</span>
                <span>{foreshadowScenes}개 씬에 미회수 복선</span>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{title}</h4>
      {children}
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number; max: number; color: string }[] }) {
  return (
    <div className="space-y-1.5">
      {data.map(({ label, value, max, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16 truncate flex-shrink-0">{label}</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs text-gray-600 w-6 text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}
