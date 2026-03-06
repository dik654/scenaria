import { useRef, useState } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useExportOps, type ExportFormat } from './exportPanel/useExportOps';
import { useImportOps } from './exportPanel/useImportOps';

type PanelMode = 'export' | 'import';

export function ExportPanel() {
  const { index: sceneIndex, currentScene } = useSceneStore();
  const [panelMode, setPanelMode] = useState<PanelMode>('export');
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportOps = useExportOps();
  const importOps = useImportOps(() => setPanelMode('export'));

  const isExporting = exportOps.isExporting;
  const error = exportOps.error ?? importOps.error;

  const switchMode = (m: PanelMode) => {
    setPanelMode(m);
    exportOps.setError(null);
    importOps.reset();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-800 flex-shrink-0">
        {(['export', 'import'] as PanelMode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)}
            className={`flex-1 py-2 text-xs transition-colors ${panelMode === m ? 'text-white border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300'}`}>
            {m === 'export' ? '내보내기' : '가져오기'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {panelMode === 'import' ? (
          <>
            <p className="text-xs text-gray-500">Fountain(.fountain) 또는 텍스트 파일에서 씬을 가져옵니다.</p>
            <input ref={fileInputRef} type="file" accept=".fountain,.txt,.text" onChange={importOps.handleFileSelect} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-xs text-gray-400 hover:border-gray-400 hover:text-white transition-colors">
              파일 선택...
            </button>

            {importOps.importPreview && (
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <p className="text-xs text-green-400 font-medium">✓ {importOps.importPreview.count}개 씬 발견</p>
                <ul className="space-y-0.5">
                  {importOps.importPreview.titles.map((t, i) => (
                    <li key={i} className="text-xs text-gray-400">S#{importOps.sceneIndexLength + 1 + i}. {t}</li>
                  ))}
                  {importOps.importPreview.count > 5 && (
                    <li className="text-xs text-gray-600">... 외 {importOps.importPreview.count - 5}개</li>
                  )}
                </ul>
                <p className="text-xs text-gray-600">현재 {importOps.sceneIndexLength}개 씬 뒤에 추가됩니다.</p>
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            {importOps.importData && (
              <button onClick={() => importOps.handleImport(() => { if (fileInputRef.current) fileInputRef.current.value = ''; })}
                disabled={importOps.isImporting}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg disabled:opacity-50 font-medium">
                {importOps.isImporting ? '가져오는 중...' : `${importOps.importData.length}개 씬 가져오기`}
              </button>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="text-xs text-gray-500 block mb-2">포맷</label>
              <div className="space-y-1.5">
                {([
                  ['txt', '한국 시나리오 TXT', '표준 한국 시나리오 텍스트 형식'],
                  ['fountain', 'Fountain', '국제 호환 시나리오 포맷'],
                  ['docx', 'Word 문서 (DOCX)', 'Microsoft Word 호환 시나리오'],
                  ['llm-context', 'LLM 컨텍스트', 'AI에게 붙여넣기용 마크다운'],
                ] as [ExportFormat, string, string][]).map(([f, label, desc]) => (
                  <label key={f} className="flex items-start gap-2 cursor-pointer group">
                    <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="mt-0.5 accent-red-500" />
                    <div>
                      <p className="text-sm text-gray-300 group-hover:text-white">{label}</p>
                      <p className="text-xs text-gray-600">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-2">범위</label>
              <div className="flex gap-2">
                <button onClick={() => setScope('all')}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${scope === 'all' ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}>
                  전체 ({sceneIndex.length}씬)
                </button>
                <button onClick={() => setScope('current')} disabled={!currentScene}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-30 ${scope === 'current' ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}>
                  현재 씬
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="space-y-2">
              <button onClick={() => exportOps.handleExport(format, scope)} disabled={isExporting}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg disabled:opacity-50 font-medium">
                {isExporting ? '내보내는 중...' : '파일로 내보내기 ↓'}
              </button>
              {format === 'llm-context' && (
                <button onClick={() => exportOps.handleCopyToClipboard(scope)} disabled={isExporting}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg disabled:opacity-50">
                  클립보드에 복사
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
