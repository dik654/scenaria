import type { Scene } from '../types/scene';

const TIME_OPTIONS = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS'];
const INT_OPTIONS = ['INT', 'EXT', 'INT/EXT', ''];

export function SceneHeader({ scene, onChange }: { scene: Scene; onChange: (updates: Partial<Scene>) => void }) {
  const { header } = scene;

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-800 font-mono text-sm">
      <span className="text-red-500 font-bold">S#{scene.id.replace('s', '').replace(/^0+/, '') || '?'}</span>
      <span className="text-gray-600">·</span>
      <select
        value={header.interior ?? ''}
        onChange={(e) => onChange({ header: { ...header, interior: e.target.value as Scene['header']['interior'] || null } })}
        className="bg-transparent text-yellow-400 font-mono text-sm focus:outline-none cursor-pointer"
      >
        {INT_OPTIONS.map((o) => (
          <option key={o} value={o} className="bg-gray-900">{o || '(없음)'}</option>
        ))}
      </select>
      <input
        value={header.location}
        onChange={(e) => onChange({ header: { ...header, location: e.target.value } })}
        placeholder="장소"
        className="bg-transparent text-white font-mono text-sm focus:outline-none border-b border-transparent focus:border-gray-600 px-1"
      />
      {header.locationDetail && (
        <>
          <span className="text-gray-600">/</span>
          <input
            value={header.locationDetail}
            onChange={(e) => onChange({ header: { ...header, locationDetail: e.target.value } })}
            className="bg-transparent text-gray-300 font-mono text-sm focus:outline-none border-b border-transparent focus:border-gray-600 px-1"
          />
        </>
      )}
      <span className="text-gray-600">-</span>
      <select
        value={header.timeOfDay}
        onChange={(e) => onChange({ header: { ...header, timeOfDay: e.target.value as Scene['header']['timeOfDay'] } })}
        className="bg-transparent text-blue-400 font-mono text-sm focus:outline-none cursor-pointer"
      >
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t} className="bg-gray-900">{t}</option>
        ))}
      </select>
      {header.timeLabel && (
        <span className="text-gray-500 text-xs">({header.timeLabel})</span>
      )}
    </div>
  );
}
