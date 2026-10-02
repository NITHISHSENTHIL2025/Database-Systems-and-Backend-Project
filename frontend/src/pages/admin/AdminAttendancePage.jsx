import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, json } from '../../lib/api.js';
import { useApiData } from '../../lib/useApiData.js';
import { Empty, Notice, PageHeader, Panel, Spinner } from '../../components/UI.jsx';
import { useLiveEvents } from '../../lib/useLiveEvents.js';

const MODEL_URL = '/models';
const SCRIPT_URL = '/vendor/face-api.min.js';

function loadScript() {
  if (window.faceapi) return Promise.resolve(window.faceapi);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.faceapi), { once: true });
      existing.addEventListener('error', () => reject(new Error('Face engine script failed to load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.faceapi);
    script.onerror = () => reject(new Error('Face engine assets are missing. Run SETUP_FACE_ENGINE.ps1 once.'));
    document.head.appendChild(script);
  });
}

async function loadModels() {
  const faceapi = await loadScript();
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  return faceapi;
}

async function detectDescriptor(input) {
  const faceapi = await loadModels();
  const detection = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.55 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) throw new Error('No clear face detected. Use good light, look straight at the camera and try again.');
  return Array.from(detection.descriptor);
}

async function imageFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not read that photo.'));
      image.src = url;
    });
    return await detectDescriptor(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AdminAttendancePage() {
  const { data, error, loading, reload } = useApiData('/admin/attendance/today');
  const { data: members, reload: reloadMembers } = useApiData('/admin/members');
  useLiveEvents(() => { reload(); reloadMembers(); });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const photoInputRef = useRef(null);
  const [mode, setMode] = useState('checkin');
  const [engine, setEngine] = useState('idle');
  const [camera, setCamera] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [photoSamples, setPhotoSamples] = useState([]);
  const [consent, setConsent] = useState(false);

  const activeMembers = useMemo(() => (members || []).filter(m => m.userStatus === 'ACTIVE'), [members]);

  useEffect(() => () => stopCamera(), []);
  useEffect(() => {
    setMessage('');
    setResult(null);
    setPhotoSamples([]);
    setProgress(0);
    setConsent(false);
  }, [mode]);

  function stopCamera() {
    streamRef.current?.getTracks?.().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera(false);
  }

  async function startCamera() {
    setMessage('');
    setEngine('loading');
    try {
      await loadModels();
      setEngine('ready');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Live camera is unavailable in this browser. Use Take photo instead.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera(true);
    } catch (err) {
      setEngine('error');
      setMessage(`${err.message || 'Camera could not start.'} You can still use Take photo / Choose photo below.`);
    }
  }

  async function liveDescriptor() {
    if (!videoRef.current) throw new Error('Camera is not ready.');
    return detectDescriptor(videoRef.current);
  }

  async function checkInDescriptor(d) {
    const r = await api('/admin/attendance/face', json('POST', { descriptor: d }));
    setResult(r);
    setMessage(r.alreadyCheckedIn ? 'Member was already checked in today.' : 'Face matched. Attendance recorded.');
    await reload();
  }

  async function checkInFace() {
    setCapturing(true); setMessage(''); setResult(null);
    try { await checkInDescriptor(await liveDescriptor()); }
    catch (err) { setMessage(err.message); }
    finally { setCapturing(false); }
  }

  async function enrollLive() {
    if (!memberId) return setMessage('Choose a member first.');
    if (!consent) return setMessage('Confirm member consent before face enrollment.');
    setCapturing(true); setMessage(''); setProgress(0);
    try {
      const samples = [];
      for (let i = 0; i < 3; i += 1) {
        samples.push(await liveDescriptor());
        setProgress(i + 1);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const r = await api('/admin/face/enroll', json('POST', { memberId: Number(memberId), descriptors: samples, consent: true }));
      setMessage(`Face enrolled for ${r.member.name}.`);
      setProgress(0);
      await reloadMembers();
    } catch (err) { setMessage(err.message); }
    finally { setCapturing(false); }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCapturing(true); setMessage(''); setResult(null);
    try {
      if (mode === 'enroll') {
        if (!memberId) throw new Error('Choose a member first.');
        if (!consent) throw new Error('Confirm member consent before capturing face samples.');
        const d = await imageFromFile(file);
        setPhotoSamples(prev => [...prev, d].slice(0, 3));
        setMessage(`Photo sample ${Math.min(photoSamples.length + 1, 3)}/3 captured.`);
      } else {
        await checkInDescriptor(await imageFromFile(file));
      }
    } catch (err) { setMessage(err.message); }
    finally { setCapturing(false); }
  }

  async function savePhotoEnrollment() {
    if (!memberId) return setMessage('Choose a member first.');
    if (!consent) return setMessage('Confirm member consent before face enrollment.');
    if (photoSamples.length < 3) return setMessage('Capture three clear face photos first.');
    setCapturing(true); setMessage('');
    try {
      const r = await api('/admin/face/enroll', json('POST', { memberId: Number(memberId), descriptors: photoSamples, consent: true }));
      setMessage(`Face enrolled for ${r.member.name}.`);
      setPhotoSamples([]);
      await reloadMembers();
    } catch (err) { setMessage(err.message); }
    finally { setCapturing(false); }
  }

  async function keyCheckIn(e) {
    e.preventDefault(); setMessage(''); setResult(null);
    try {
      const r = await api('/admin/attendance/key', json('POST', { loginKey: key }));
      setResult(r);
      setMessage(r.alreadyCheckedIn ? 'Member was already checked in today.' : 'Gym Key verified. Attendance recorded.');
      setKey('');
      await reload();
    } catch (err) { setMessage(err.message); }
  }

  if (loading) return <Spinner />;

  return <>
    <PageHeader eyebrow="FACE ATTENDANCE" title="Fast member check-in." copy="Use live camera on localhost, or Take photo on a phone. Unclear matches never auto-check in — use the member’s six-digit Gym Key instead." />
    {error && <Notice type="error">{error}</Notice>}
    {message && <Notice type={/recorded|enrolled/i.test(message) ? 'success' : /already/i.test(message) ? 'info' : 'error'}>{message}</Notice>}

    <div className="attendance-mode-tabs">
      <button className={mode === 'checkin' ? 'active' : ''} onClick={() => setMode('checkin')}>Check in</button>
      <button className={mode === 'enroll' ? 'active' : ''} onClick={() => setMode('enroll')}>Enroll face</button>
    </div>

    <div className="portal-grid two-thirds">
      <Panel title={mode === 'checkin' ? 'Face check-in' : 'Face enrollment'}>
        {mode === 'enroll' && <div className="face-enroll-controls">
          <label>Member
            <select value={memberId} onChange={e => { setMemberId(e.target.value); setPhotoSamples([]); setProgress(0); }}>
              <option value="">Choose member</option>
              {activeMembers.map(m => <option key={m.id} value={m.id}>{m.name} · Key {m.loginKey || '—'}{m.faceEnrolled ? ' · enrolled' : ''}</option>)}
            </select>
          </label>
          <label className="face-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Member has agreed to face check-in enrollment.</label>
        </div>}

        <div className="face-camera-box">
          <video ref={videoRef} muted playsInline />
          <div className="face-guide"><span>FACE</span></div>
          {!camera && <div className="face-camera-off">Live camera is off.</div>}
        </div>

        <div className="face-action-row">
          {!camera ? <button className="button button-primary" onClick={startCamera}>{engine === 'loading' ? 'Loading face engine…' : 'Start live camera'}</button> : <>
            {mode === 'checkin'
              ? <button className="button button-primary" disabled={capturing} onClick={checkInFace}>{capturing ? 'Matching…' : 'Scan live face'}</button>
              : <button className="button button-primary" disabled={capturing || !memberId || !consent} onClick={enrollLive}>{capturing ? `Capturing ${progress}/3…` : 'Capture 3 live samples'}</button>}
            <button className="button button-ghost-dark" type="button" onClick={stopCamera}>Stop camera</button>
          </>}
        </div>

        <div className="face-photo-option">
          <span className="eyebrow">PHONE / CAMERA FALLBACK</span>
          <p>Take a photo or choose one from the device. This works even when a phone browser blocks live camera on a local HTTP address.</p>
          <input ref={photoInputRef} className="face-file-input" type="file" accept="image/*" capture="user" onChange={handlePhoto} />
          <button className="button button-ghost-dark" type="button" disabled={capturing || (mode === 'enroll' && (!memberId || !consent || photoSamples.length >= 3))} onClick={() => photoInputRef.current?.click()}>
            {capturing ? 'Reading face…' : mode === 'checkin' ? 'Take photo / Choose photo' : `Add photo sample (${photoSamples.length}/3)`}
          </button>
          {mode === 'enroll' && photoSamples.length > 0 && <div className="photo-sample-progress"><span>{photoSamples.length}/3 samples ready</span>{photoSamples.length === 3 && <button className="button button-primary" type="button" disabled={capturing} onClick={savePhotoEnrollment}>Save face enrollment</button>}</div>}
        </div>

        <div className="face-help">Use even light and one person in frame. GymFit stores numeric face descriptors for matching; it does not keep the captured enrollment photos.</div>

        {mode === 'checkin' && <form className="gym-key-fallback" onSubmit={keyCheckIn}>
          <span className="eyebrow">FALLBACK VERIFICATION</span>
          <div><input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" placeholder="6-digit Gym Key" value={key} onChange={e => setKey(e.target.value.replace(/\D/g,'').slice(0,6))} required/><button className="button button-dark">Check in by key</button></div>
        </form>}

        {result && <div className="scan-result"><strong>✓ {result.member.name}</strong><span>{result.membership}</span><span>{new Date(result.attendance.checkInAt).toLocaleTimeString()}</span></div>}
      </Panel>

      <Panel title="Today"><div className="big-attendance-number">{data?.length || 0}</div><p>checked in today</p></Panel>
    </div>

    <Panel title="Today’s attendance">
      {data?.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Member</th><th>Check in</th><th>Method</th></tr></thead><tbody>{data.map(a => <tr key={a.id}><td><strong>{a.member.user.name}</strong><small>Key {a.member.user.loginKey || '—'}</small></td><td>{new Date(a.checkInAt).toLocaleTimeString()}</td><td>{a.source}</td></tr>)}</tbody></table></div> : <Empty title="No attendance yet" />}
    </Panel>
  </>;
}
