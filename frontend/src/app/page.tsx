'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore, ChatRecord } from '@/store/projectStore';
import { importAnalyzedCsv } from '@/lib/analyzedCsvImport';

type MappingType = {
  id: string;
  datetime: string;
  speaker: string;
  text: string;
  speakerParticipantValue: string;
  speakerOtherValue: string;
  userId: string;
};

// カラム名パターンによる自動検出
function autoDetectMapping(headers: string[], rawData: string[][]): Partial<MappingType> {
  const result: Partial<MappingType> = {};

  // カラム名マッチパターン
  const patterns: Record<keyof Pick<MappingType, 'id' | 'datetime' | 'speaker' | 'text' | 'userId'>, RegExp> = {
    id: /^(id|番号|no|index|コメントid|発話id)$/i,
    datetime: /^(datetime|date|time|日時|timestamp|送信日時|created_at)$/i,
    speaker: /^(speaker|発話者|話者|role|送信者|from|from_type)$/i,
    text: /^(text|テキスト|本文|発話|message|内容|メッセージ|body|content)$/i,
    userId: /^(user_id|userid|ユーザー|ユーザーid|participant_id|participant)$/i,
  };

  // ヘッダー名でマッチ
  for (const header of headers) {
    const trimmed = header.trim();
    for (const [field, pattern] of Object.entries(patterns)) {
      if (pattern.test(trimmed) && !result[field as keyof typeof patterns]) {
        result[field as keyof typeof patterns] = header;
        break;
      }
    }
  }

  // speaker列が見つかった場合、値を推定
  if (result.speaker && rawData.length > 0) {
    const speakerIdx = headers.indexOf(result.speaker);
    if (speakerIdx >= 0) {
      const uniqueValues = [...new Set(rawData.map((r) => r[speakerIdx]).filter(Boolean))];

      // 2種類以下なら推定を試みる
      if (uniqueValues.length <= 3) {
        const participantPattern = /^(participant|参加者|ユーザー|user|client|patient)$/i;
        const otherPattern = /^(other|介入者|相手|coach|admin|counselor|operator|staff)$/i;

        for (const val of uniqueValues) {
          if (participantPattern.test(val)) {
            result.speakerParticipantValue = val;
          } else if (otherPattern.test(val)) {
            result.speakerOtherValue = val;
          }
        }

        // パターンに一致しなかった場合、最初の2値を割り当て
        if (!result.speakerParticipantValue && !result.speakerOtherValue && uniqueValues.length === 2) {
          result.speakerParticipantValue = uniqueValues[0];
          result.speakerOtherValue = uniqueValues[1];
        }
      }
    }
  }

  return result;
}

export default function Home() {
  const router = useRouter();
  const { setProject, setData, setColumnMapping, reset } = useProjectStore();

  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<MappingType>({
    id: '',
    datetime: '',
    speaker: '',
    text: '',
    speakerParticipantValue: '参加者',
    speakerOtherValue: 'other',
    userId: '',
  });
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [autoDetected, setAutoDetected] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
        // 画面遷移はしない（ファイル名表示のみ）
      }
    };
    reader.readAsText(selectedFile, 'UTF-8');
  }, []);

  // 「次へ」ボタン：自動検出 + マッピング画面に遷移
  const handleProceedToMapping = useCallback(() => {
    if (headers.length === 0 || rawData.length === 0) return;

    // カラムマッピング自動検出
    const detected = autoDetectMapping(headers, rawData);
    const detectedFields: string[] = [];

    // 検出結果をマッピングに反映
    const newMapping: MappingType = {
      id: detected.id || '',
      datetime: detected.datetime || '',
      speaker: detected.speaker || '',
      text: detected.text || '',
      speakerParticipantValue: detected.speakerParticipantValue || '参加者',
      speakerOtherValue: detected.speakerOtherValue || 'other',
      userId: detected.userId || '',
    };

    // 検出できたフィールドを記録
    if (detected.id) detectedFields.push('コメントID');
    if (detected.datetime) detectedFields.push('日時');
    if (detected.speaker) detectedFields.push('話者');
    if (detected.text) detectedFields.push('テキスト');
    if (detected.userId) detectedFields.push('ユーザーID');
    if (detected.speakerParticipantValue) detectedFields.push('参加者値');
    if (detected.speakerOtherValue) detectedFields.push('介入者値');

    setMapping(newMapping);
    setAutoDetected(detectedFields);
    setStep('mapping');
  }, [headers, rawData]);

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

  const handleImportClick = () => {
    if (importLoading) return;
    importInputRef.current?.click();
  };

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setImportLoading(true);

    try {
      const result = await importAnalyzedCsv(selectedFile);
      const projectId = `project_${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
      const projectName = selectedFile.name.replace(/\.[^.]+$/, '') || '新規プロジェクト';

      reset();
      setProject(projectId, projectName);
      setData(result.records);

      router.push(`/project/${projectId}/step/11`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSVの読み込みに失敗しました';
      window.alert(`インポートエラー: ${message}`);
    } finally {
      setImportLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-center">
          テキストチャット介入分析ツール
        </h1>
        <p className="text-xs text-gray-400 text-center mb-6">v3.2</p>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-xl font-bold mb-4">新規分析を開始</h2>
              <p className="text-gray-600 mb-6">
                CSV または Excel ファイルをアップロードしてください。
              </p>

              {!file ? (
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
              ) : (
                <div className="border-2 border-green-300 bg-green-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-500">選択済み</p>
                      <p className="text-lg font-medium text-gray-800">{file.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {rawData.length} 件のデータ / {headers.length} カラム
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <label
                      htmlFor="file-upload-change"
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded cursor-pointer hover:bg-gray-300"
                    >
                      別のファイルを選択
                    </label>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload-change"
                    />
                    <button
                      onClick={handleProceedToMapping}
                      className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      次へ
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm text-gray-400">または</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="bg-white rounded-lg shadow p-8">
              <h2 className="text-xl font-bold mb-2">分析済みCSVをインポート</h2>
              <p className="text-gray-600 mb-6">
                すでに分析が完了したCSVをインポートして結果を確認
              </p>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportChange}
                className="hidden"
              />
              <button
                onClick={handleImportClick}
                disabled={importLoading}
                className={`px-6 py-2 rounded text-white ${
                  importLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {importLoading ? 'インポート中...' : '分析済みCSVをインポート'}
              </button>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-xl font-bold mb-4">カラムマッピング</h2>
            <p className="text-gray-600 mb-6">
              各フィールドに対応するカラムを選択してください。
            </p>

            {autoDetected.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-green-800 text-sm">
                  自動検出: {autoDetected.join(', ')}
                </p>
                <p className="text-green-600 text-xs mt-1">
                  検出結果を初期値として設定しました。必要に応じて修正してください。
                </p>
              </div>
            )}

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
