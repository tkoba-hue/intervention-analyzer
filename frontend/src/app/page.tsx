'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore, ChatRecord } from '@/store/projectStore';

export default function Home() {
  const router = useRouter();
  const { setProject, setData, setColumnMapping, reset } = useProjectStore();

  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({
    id: '',
    datetime: '',
    speaker: '',
    text: '',
    speakerParticipantValue: '参加者',
    speakerOtherValue: 'other',
    userId: '',
  });
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());
      const rows = lines.map((line) => {
        // 簡易CSVパース（カンマ区切り、ダブルクォート対応）
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });

      if (rows.length > 0) {
        setHeaders(rows[0]);
        setRawData(rows.slice(1));
        setStep('mapping');
      }
    };
    reader.readAsText(selectedFile, 'UTF-8');
  }, []);

  const handleMappingChange = (field: keyof typeof mapping, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed =
    mapping.id && mapping.datetime && mapping.speaker && mapping.text;

  const handlePreview = () => {
    if (canProceed) {
      setStep('preview');
    }
  };

  const handleStart = () => {
    // データを変換
    const idIndex = headers.indexOf(mapping.id);
    const datetimeIndex = headers.indexOf(mapping.datetime);
    const speakerIndex = headers.indexOf(mapping.speaker);
    const textIndex = headers.indexOf(mapping.text);
    const userIdIndex = mapping.userId ? headers.indexOf(mapping.userId) : -1;

    const records: ChatRecord[] = rawData.map((row, index) => {
      const speakerValue = row[speakerIndex] || '';
      const isParticipant = speakerValue === mapping.speakerParticipantValue;

      return {
        id: row[idIndex] || String(index + 1),
        user_id: userIdIndex >= 0 ? row[userIdIndex] : undefined,
        datetime: row[datetimeIndex] || '',
        speaker: isParticipant ? 'participant' : 'other',
        text_raw: row[textIndex] || '',
        exclude_flag: false,
        evidence_anchor: 0,
        evidence_anchor_confidence: 0,
        evidence_flag_strict: false,
        trigger_type_auto: [],
        trigger_type_final: [],
        linked_other_ids: [],
      };
    });

    // プロジェクトを設定
    const projectId = `project_${Date.now()}`;
    const projectName = file?.name.replace(/\.[^.]+$/, '') || '新規プロジェクト';

    reset();
    setProject(projectId, projectName);
    setColumnMapping(mapping);
    setData(records);

    // Step 1 に遷移
    router.push(`/project/${projectId}/step/1`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          テキストチャット介入分析ツール
        </h1>

        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-xl font-bold mb-4">データをアップロード</h2>
            <p className="text-gray-600 mb-6">
              CSV または Excel ファイルをアップロードしてください。
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-blue-500 hover:text-blue-600"
              >
                ファイルを選択
              </label>
              <p className="text-gray-400 mt-2">
                または、ここにドラッグ＆ドロップ
              </p>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-xl font-bold mb-4">カラムマッピング</h2>
            <p className="text-gray-600 mb-6">
              各フィールドに対応するカラムを選択してください。
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ユーザーID列 <span className="text-gray-400">（任意）</span>
                </label>
                <select
                  value={mapping.userId}
                  onChange={(e) => handleMappingChange('userId', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- なし --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  ユーザーIDがあると、ユーザー別の集計が可能になります
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  コメントID列 <span className="text-red-500">*</span>
                </label>
                <select
                  value={mapping.id}
                  onChange={(e) => handleMappingChange('id', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- 選択 --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  各発話を識別するIDです
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日時列 <span className="text-red-500">*</span>
                </label>
                <select
                  value={mapping.datetime}
                  onChange={(e) => handleMappingChange('datetime', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- 選択 --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  話者列 <span className="text-red-500">*</span>
                </label>
                <select
                  value={mapping.speaker}
                  onChange={(e) => handleMappingChange('speaker', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- 選択 --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  テキスト列 <span className="text-red-500">*</span>
                </label>
                <select
                  value={mapping.text}
                  onChange={(e) => handleMappingChange('text', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- 選択 --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium mb-2">話者の値</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      参加者を表す値
                    </label>
                    <input
                      type="text"
                      value={mapping.speakerParticipantValue}
                      onChange={(e) =>
                        handleMappingChange('speakerParticipantValue', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      介入側を表す値
                    </label>
                    <input
                      type="text"
                      value={mapping.speakerOtherValue}
                      onChange={(e) =>
                        handleMappingChange('speakerOtherValue', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep('upload')}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                戻る
              </button>
              <button
                onClick={handlePreview}
                disabled={!canProceed}
                className={`px-6 py-2 rounded ${
                  canProceed
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                プレビュー
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-xl font-bold mb-4">プレビュー</h2>
            <p className="text-gray-600 mb-6">
              データの内容を確認してください（最初の10件）
            </p>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    {mapping.userId && <th className="border p-2">ユーザーID</th>}
                    <th className="border p-2">コメントID</th>
                    <th className="border p-2">日時</th>
                    <th className="border p-2">話者</th>
                    <th className="border p-2">テキスト</th>
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(0, 10).map((row, index) => {
                    const idIndex = headers.indexOf(mapping.id);
                    const datetimeIndex = headers.indexOf(mapping.datetime);
                    const speakerIndex = headers.indexOf(mapping.speaker);
                    const textIndex = headers.indexOf(mapping.text);
                    const userIdIndex = mapping.userId ? headers.indexOf(mapping.userId) : -1;

                    return (
                      <tr key={index}>
                        {mapping.userId && (
                          <td className="border p-2">{userIdIndex >= 0 ? row[userIdIndex] : ''}</td>
                        )}
                        <td className="border p-2">{row[idIndex]}</td>
                        <td className="border p-2">{row[datetimeIndex]}</td>
                        <td className="border p-2">{row[speakerIndex]}</td>
                        <td className="border p-2 max-w-md truncate">
                          {row[textIndex]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 rounded p-4 mb-6">
              <p className="text-sm text-blue-800">
                全 {rawData.length} 件のデータを読み込みました
              </p>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('mapping')}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                戻る
              </button>
              <button
                onClick={handleStart}
                className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                分析を開始
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
