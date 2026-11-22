'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Phone, MapPin, Save, Trash2 } from 'lucide-react';
import styles from './page.module.css';

const SURVEY_STATUSES = [
  { value: 'CONFIRMED', label: '地址正確', cssClass: 'statusCONFIRMED' },
  { value: 'UPDATED', label: '資料已更新', cssClass: 'statusUPDATED' },
  { value: 'NOT_FOUND', label: '查無此人', cssClass: 'statusNOT_FOUND' },
  { value: 'WRONG_ADDRESS', label: '地址有誤', cssClass: 'statusWRONG_ADDRESS' },
  { value: 'MOVED', label: '已遷移', cssClass: 'statusMOVED' },
] as const;

interface MemberData {
  id: string;
  serialNumber: number | null;
  name: string;
  postalCode: string | null;
  city: string;
  district: string | null;
  village: string | null;
  address: string;
  fullAddress: string;
  phone: string | null;
  note: string | null;
  surveyStatus: string;
  surveyNote: string | null;
  surveyedAt: string | null;
  surveyedBy?: { displayName: string } | null;
}

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  // Survey
  const [surveyStatus, setSurveyStatus] = useState('');
  const [surveyNote, setSurveyNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch current user role
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data: { user: { role: string } }) => setUserRole(data.user?.role || ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data: { member: MemberData }) => {
        const m = data.member;
        setMember(m);
        setName(m.name);
        setAddress(m.address);
        setPhone(m.phone || '');
        setNote(m.note || '');
        setSurveyStatus(m.surveyStatus);
        setSurveyNote(m.surveyNote || '');
      })
      .catch(() => {
        setMember(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Update member data
      const updateRes = await fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, phone: phone || null, note: note || null }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.json();
        throw new Error(err.error || '更新失敗');
      }

      // Update survey status if changed
      if (surveyStatus && surveyStatus !== member?.surveyStatus) {
        const surveyRes = await fetch(`/api/members/${id}/survey`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surveyStatus,
            surveyNote: surveyNote || null,
          }),
        });

        if (!surveyRes.ok) {
          const err = await surveyRes.json();
          throw new Error(err.error || '普查狀態更新失敗');
        }
      }

      setMessage({ type: 'success', text: '✅ 儲存成功' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '儲存失敗',
      });
    } finally {
      setSaving(false);
    }
  };

  const canDelete = userRole === 'ADMIN' || userRole === 'EDITOR';

  const handleDelete = async () => {
    if (!confirm('確定要刪除此宗親記錄嗎？此操作無法復原。')) return;

    setDeleting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '刪除失敗');
      }
      router.push('/members');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '刪除失敗',
      });
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className={styles.page}><p>載入中...</p></div>;
  }

  if (!member) {
    return (
      <div className={styles.page}>
        <p>找不到此宗親資料</p>
        <Link href="/members" className={styles.backLink}>← 返回名單</Link>
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(member.fullAddress)}`;

  return (
    <div className={styles.page}>
      <Link href="/members" className={styles.backLink}>
        <ArrowLeft size={18} /> 返回名單
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.name}>{member.name}</h1>
          {member.serialNumber && (
            <span className={styles.serialNumber}>序號 #{member.serialNumber}</span>
          )}
        </div>
      </div>

      {/* Basic Info Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>基本資料</h2>
        <div className={styles.fieldGroup}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>姓名</label>
            <input
              type="text"
              className={styles.fieldInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>縣市</label>
            <span className={styles.fieldValue}>{member.city}</span>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>區域</label>
            <span className={styles.fieldValue}>{member.district || '—'}</span>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>里</label>
            <span className={styles.fieldValue}>{member.village || '—'}</span>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>地址</label>
            <input
              type="text"
              className={styles.fieldInput}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>電話</label>
            <input
              type="tel"
              className={styles.fieldInput}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="電話號碼"
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>快速動作</h2>
        <div className={styles.fieldGroup}>
          {phone && (
            <div className={styles.field}>
              <a href={`tel:${phone}`} className={styles.actionLink}>
                <Phone size={18} /> 撥打電話：{phone}
              </a>
            </div>
          )}
          <div className={styles.field}>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.actionLink}
            >
              <MapPin size={18} /> 在 Google Maps 開啟地址
            </a>
          </div>
        </div>
      </div>

      {/* Survey Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>普查狀態</h2>
        <div className={styles.statusButtons}>
          {SURVEY_STATUSES.map((s) => {
            const isSelected = surveyStatus === s.value;
            const hasSelection = surveyStatus !== 'PENDING' && surveyStatus !== '';
            let btnClass = `${styles.statusBtn} ${styles[s.cssClass]}`;
            if (isSelected) btnClass += ` ${styles.statusBtnSelected}`;
            else if (hasSelection && surveyStatus !== 'PENDING') btnClass += ` ${styles.statusBtnUnselected}`;

            return (
              <button
                key={s.value}
                type="button"
                className={btnClass}
                onClick={() => setSurveyStatus(s.value)}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div className={styles.field} style={{ marginTop: 'var(--spacing-md)' }}>
          <label className={styles.fieldLabel}>普查備註</label>
          <textarea
            className={styles.fieldTextarea}
            value={surveyNote}
            onChange={(e) => setSurveyNote(e.target.value)}
            placeholder="輸入備註..."
          />
        </div>
      </div>

      {/* Notes Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>備註</h2>
        <textarea
          className={styles.fieldTextarea}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="輸入備註..."
        />
      </div>

      {message && (
        <p className={message.type === 'success' ? styles.successMsg : styles.errorMsg}>
          {message.text}
        </p>
      )}

      <button
        className={styles.saveBtn}
        onClick={handleSave}
        disabled={saving}
      >
        <Save size={20} />
        {saving ? '儲存中...' : '儲存'}
      </button>

      {canDelete && (
        <button
          className={styles.deleteBtn}
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 size={20} />
          {deleting ? '刪除中...' : '刪除此記錄'}
        </button>
      )}
    </div>
  );
}
