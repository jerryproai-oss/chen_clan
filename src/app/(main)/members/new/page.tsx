'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import styles from './page.module.css';

const CITIES = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '嘉義市', '新竹縣', '苗栗縣', '彰化縣',
  '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣',
];

export default function NewMemberPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('請輸入姓名'); return; }
    if (!city) { setError('請選擇縣市'); return; }
    if (!address.trim()) { setError('請輸入地址'); return; }

    setSubmitting(true);

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          postalCode: postalCode.trim() || null,
          city,
          district: district.trim() || null,
          village: village.trim() || null,
          address: address.trim(),
          phone: phone.trim() || null,
          note: note.trim() || null,
          surveyStatus: 'NEW',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '新增失敗');
      }

      router.push('/members');
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Link href="/members" className={styles.backLink}>
        <ArrowLeft size={18} /> 返回名單
      </Link>

      <h1 className={styles.pageTitle}>新增宗親</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              姓名 <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.fieldInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="宗親姓名"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>郵遞區號</label>
            <input
              type="text"
              className={styles.fieldInput}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="例如 100"
              maxLength={6}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              縣市 <span className={styles.required}>*</span>
            </label>
            <select
              className={styles.fieldSelect}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            >
              <option value="">請選擇縣市</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>區域</label>
            <input
              type="text"
              className={styles.fieldInput}
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="例如 中正區"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>里</label>
            <input
              type="text"
              className={styles.fieldInput}
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="例如 永昌里"
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.fieldLabel}>
              地址 <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.fieldInput}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="詳細地址"
              required
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

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.fieldLabel}>備註</label>
            <textarea
              className={styles.fieldTextarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="備註..."
            />
          </div>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={submitting}
        >
          <Save size={20} />
          {submitting ? '儲存中...' : '儲存'}
        </button>
      </form>
    </div>
  );
}
