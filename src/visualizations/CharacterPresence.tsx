import { useSceneStore } from '../store/sceneStore';
import { useCharacterStore } from '../store/characterStore';

type PresenceMode = 'heatmap' | 'absence';

/**
 * Character Presence Chart — shows which characters appear in which scenes.
 * Data is derived from scene index entries' `characters` field.
 * (Phase 0 scenes don't have this yet — shows blank until scenes are enriched.)
 */
export function CharacterPresence({ mode = 'heatmap' }: { mode?: PresenceMode }) {
  const { index: scenes } = useSceneStore();
  const { index: chars } = useCharacterStore();

  if (chars.length === 0 || scenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        캐릭터와 씬을 추가하면 등장 차트가 표시됩니다
      </div>
    );
  }

  const CELL_W = Math.max(12, Math.min(28, Math.floor(600 / scenes.length)));
  const CELL_H = 24;
  const LABEL_W = 100;

  type SceneEntry = typeof scenes[0] & { characters?: string[] };

  return (
    <div className="overflow-auto h-full p-3">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-gray-500">캐릭터 등장 차트</span>
        <div className="flex gap-3 text-xs text-gray-600">
          <span><span className="inline-block w-3 h-3 rounded-sm bg-red-600 mr-1 align-middle" />등장+대사</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-blue-800 mr-1 align-middle" />등장만</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-gray-200 mr-1 align-middle" />미등장</span>
        </div>
      </div>

      {/* Scroll container */}
      <div style={{ minWidth: LABEL_W + scenes.length * CELL_W }}>
        {/* Scene number header */}
        <div className="flex mb-1" style={{ paddingLeft: LABEL_W }}>
          {scenes.map((s, i) => (
            (i % Math.max(1, Math.floor(scenes.length / 15)) === 0) ? (
              <div
                key={s.id}
                className="text-center text-xs text-gray-600 font-mono"
                style={{ width: CELL_W, flexShrink: 0, fontSize: 9 }}
              >
                {s.number}
              </div>
            ) : (
              <div key={s.id} style={{ width: CELL_W, flexShrink: 0 }} />
            )
          ))}
        </div>

        {/* Character rows */}
        {chars.map(char => {
          const appearances = scenes.map(s => {
            const charList = (s as SceneEntry).characters ?? [];
            if (charList.includes(char.id)) return 'appears';
            return 'absent';
          });

          // Compute max absence streak
          let maxAbsence = 0;
          let cur = 0;
          for (const a of appearances) {
            if (a === 'absent') { cur++; maxAbsence = Math.max(maxAbsence, cur); }
            else cur = 0;
          }

          return (
            <div key={char.id} className="flex items-center mb-0.5">
              {/* Name label */}
              <div
                className="text-xs text-gray-600 truncate flex-shrink-0 pr-2 text-right"
                style={{ width: LABEL_W }}
                title={char.name}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: char.color }} />
                {char.name}
              </div>

              {/* Cells */}
              {appearances.map((status, i) => (
                <div
                  key={i}
                  title={`장면 ${scenes[i].number}: ${scenes[i].location} — ${status === 'appears' ? '등장' : '미등장'}`}
                  className="rounded-sm mx-px cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    width: CELL_W - 2,
                    height: CELL_H - 4,
                    flexShrink: 0,
                    backgroundColor:
                      status === 'appears' ? char.color :
                      '#1f2937',
                    opacity: status === 'appears' ? 0.85 : 0.3,
                  }}
                />
              ))}

              {/* Absence stat */}
              {maxAbsence > 3 && (
                <span className="text-xs text-gray-600 ml-2 flex-shrink-0">
                  최대 {maxAbsence}씬 부재
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
