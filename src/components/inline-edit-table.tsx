'use client';

import { useState, useCallback, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { EditableCell } from './editable-cell';
import { StatusDropdown } from './status-dropdown';
import { BatchSaveBar } from './batch-save-bar';
import { ConflictDialog, ConflictItem } from './conflict-dialog';
import styles from './inline-edit-table.module.css';

export interface InlineMember {
  id: string;
  serialNumber: number | null;
  name: string;
  city: string;
  district: string | null;
  address: string;
  phone: string | null;
  surveyStatus: string;
  version: number;
  _isNew?: boolean;
}

interface ModifiedFields {
  name?: string;
  city?: string;
  district?: string | null;
  address?: string;
  phone?: string | null;
  surveyStatus?: string;
}

interface InlineEditTableProps {
  members: InlineMember[];
  onRefresh: () => void;
}

export function InlineEditTable({ members, onRefresh }: InlineEditTableProps) {
  const [rows, setRows] = useState<InlineMember[]>(members);
  const [modifications, setModifications] = useState<Map<string, ModifiedFields>>(new Map());
  const [newRows, setNewRows] = useState<InlineMember[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const cellRefs = useRef<Map<string, () => void>>(new Map());

  // Sync rows from parent when members change
  useState(() => {
    setRows(members);
    setModifications(new Map());
    setNewRows([]);
    setDeletedIds(new Set());
  });

  const modifiedCount = modifications.size + newRows.length + deletedIds.size;

  const updateField = useCallback(
    (id: string, field: keyof ModifiedFields, value: string | null) => {
      setModifications((prev) => {
        const next = new Map(prev);
        const existing = next.get(id) || {};
        existing[field] = value as string & (string | null);
        next.set(id, existing);
        return next;
      });
    },
    []
  );

  const updateNewRowField = useCallback(
    (index: number, field: keyof InlineMember, value: string | null) => {
      setNewRows((prev) => {
        const next = [...prev];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next[index] as any)[field] = value;
        return next;
      });
    },
    []
  );

  const getDisplayValue = (member: InlineMember, field: keyof ModifiedFields): string => {
    const mod = modifications.get(member.id);
    if (mod && field in mod) {
      return (mod[field] ?? '') as string;
    }
    return (member[field] ?? '') as string;
  };

  const addNewRow = () => {
    const tempId = `new_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setNewRows((prev) => [
      ...prev,
      {
        id: tempId,
        serialNumber: null,
        name: '',
        city: '',
        district: null,
        address: '',
        phone: null,
        surveyStatus: 'PENDING',
        version: 0,
        _isNew: true,
      },
    ]);
  };

  const deleteRow = async (id: string, isNew: boolean) => {
    if (isNew) {
      setNewRows((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    // Mark existing row for deletion
    setDeletedIds((prev) => new Set(prev).add(id));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setConflicts([]);

    try {
      // 1. Delete marked rows
      const deletePromises = Array.from(deletedIds).map(async (id) => {
        const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `刪除失敗: ${id}`);
        }
      });
      await Promise.all(deletePromises);

      // 2. Create new rows
      const createPromises = newRows
        .filter((r) => r.name.trim())
        .map(async (r) => {
          const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: r.name,
              city: r.city || '未指定',
              address: r.address || '未填寫',
              district: r.district || null,
              phone: r.phone || null,
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || '新增失敗');
          }
        });
      await Promise.all(createPromises);

      // 3. Batch update modified rows
      if (modifications.size > 0) {
        const updates = Array.from(modifications.entries()).map(([id, fields]) => {
          const original = rows.find((r) => r.id === id);
          return {
            id,
            version: original?.version ?? 0,
            ...fields,
          };
        });

        const res = await fetch('/api/members/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '批次更新失敗');
        }

        const result = await res.json();
        const conflictResults = result.results?.filter(
          (r: { status: string }) => r.status === 'conflict'
        );

        if (conflictResults && conflictResults.length > 0) {
          const conflictItems: ConflictItem[] = conflictResults.map(
            (c: { id: string; currentVersion?: number }) => {
              const member = rows.find((r) => r.id === c.id);
              return {
                id: c.id,
                name: member?.name || '未知',
                currentVersion: c.currentVersion || 0,
              };
            }
          );
          setConflicts(conflictItems);
          setSaving(false);
          return;
        }
      }

      // Success — refresh
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAll = () => {
    setModifications(new Map());
    setNewRows([]);
    setDeletedIds(new Set());
  };

  const handleConflictReload = () => {
    setConflicts([]);
    onRefresh();
  };

  const handleForceOverwrite = async () => {
    // Re-submit with force (no version check) — update versions first
    const conflictIds = new Set(conflicts.map((c) => c.id));
    setModifications((prev) => {
      const next = new Map(prev);
      // Remove conflict entries, they'll be re-fetched
      for (const id of conflictIds) {
        next.delete(id);
      }
      return next;
    });
    setConflicts([]);
    onRefresh();
  };

  const visibleRows = rows.filter((r) => !deletedIds.has(r.id));

  return (
    <div className={styles.wrapper}>
      <BatchSaveBar
        modifiedCount={modifiedCount}
        onSaveAll={handleSaveAll}
        onCancelAll={handleCancelAll}
        saving={saving}
      />

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.serialCol}>序號</th>
            <th>姓名</th>
            <th>縣市</th>
            <th>區域</th>
            <th>地址</th>
            <th>電話</th>
            <th>狀態</th>
            <th className={styles.actionCell}></th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((member) => {
            const isModified = modifications.has(member.id);
            return (
              <tr
                key={member.id}
                className={isModified ? styles.rowModified : undefined}
              >
                <td className={styles.serialCol}>
                  {member.serialNumber ?? '—'}
                </td>
                <td>
                  <EditableCell
                    value={getDisplayValue(member, 'name')}
                    onChange={(v) => updateField(member.id, 'name', v)}
                    placeholder="姓名"
                  />
                </td>
                <td>
                  <EditableCell
                    value={getDisplayValue(member, 'city')}
                    onChange={(v) => updateField(member.id, 'city', v)}
                    placeholder="縣市"
                  />
                </td>
                <td>
                  <EditableCell
                    value={getDisplayValue(member, 'district')}
                    onChange={(v) => updateField(member.id, 'district', v || null)}
                    placeholder="區域"
                  />
                </td>
                <td>
                  <EditableCell
                    value={getDisplayValue(member, 'address')}
                    onChange={(v) => updateField(member.id, 'address', v)}
                    placeholder="地址"
                  />
                </td>
                <td>
                  <EditableCell
                    value={getDisplayValue(member, 'phone')}
                    onChange={(v) => updateField(member.id, 'phone', v || null)}
                    placeholder="電話"
                    type="tel"
                  />
                </td>
                <td>
                  <StatusDropdown
                    value={getDisplayValue(member, 'surveyStatus')}
                    onChange={(v) => updateField(member.id, 'surveyStatus', v)}
                  />
                </td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => deleteRow(member.id, false)}
                    title="刪除"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
          {newRows.map((row, idx) => (
            <tr key={row.id} className={styles.rowNew}>
              <td className={styles.serialCol}>✦</td>
              <td>
                <EditableCell
                  value={row.name}
                  onChange={(v) => updateNewRowField(idx, 'name', v)}
                  placeholder="姓名"
                />
              </td>
              <td>
                <EditableCell
                  value={row.city}
                  onChange={(v) => updateNewRowField(idx, 'city', v)}
                  placeholder="縣市"
                />
              </td>
              <td>
                <EditableCell
                  value={row.district || ''}
                  onChange={(v) => updateNewRowField(idx, 'district', v || null)}
                  placeholder="區域"
                />
              </td>
              <td>
                <EditableCell
                  value={row.address}
                  onChange={(v) => updateNewRowField(idx, 'address', v)}
                  placeholder="地址"
                />
              </td>
              <td>
                <EditableCell
                  value={row.phone || ''}
                  onChange={(v) => updateNewRowField(idx, 'phone', v || null)}
                  placeholder="電話"
                  type="tel"
                />
              </td>
              <td>
                <StatusDropdown
                  value={row.surveyStatus}
                  onChange={(v) => updateNewRowField(idx, 'surveyStatus', v)}
                />
              </td>
              <td className={styles.actionCell}>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => deleteRow(row.id, true)}
                  title="移除"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className={styles.addRowBtn} onClick={addNewRow}>
        ＋ 新增一列
      </button>

      {conflicts.length > 0 && (
        <ConflictDialog
          conflicts={conflicts}
          onReload={handleConflictReload}
          onForceOverwrite={handleForceOverwrite}
          onClose={() => setConflicts([])}
        />
      )}
    </div>
  );
}
