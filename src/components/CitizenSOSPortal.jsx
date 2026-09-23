import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  Flame, 
  Ambulance, 
  Car, 
  Waves, 
  Globe, 
  Building2, 
  Zap, 
  ShieldAlert, 
  Wind, 
  MapPin, 
  Camera, 
  Video,
  ImagePlus,
  Send, 
  CheckCircle2, 
  Clock, 
  Users, 
  FileText,
  WifiOff
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { NAGPUR_CENTER } from '../services/mockData';

const CATEGORIES = [
  { id: 'Fire', label: 'Fire', icon: Flame, color: 'from-orange-600 to-red-600', border: 'border-orange-500/50' },
  { id: 'Medical Emergency', label: 'Medical', icon: Ambulance, color: 'from-red-600 to-rose-700', border: 'border-red-500/50' },
  { id: 'Road Accident', label: 'Accident', icon: Car, color: 'from-amber-600 to-orange-600', border: 'border-amber-500/50' },
  { id: 'Flood', label: 'Flood', icon: Waves, color: 'from-blue-600 to-cyan-700', border: 'border-blue-500/50' },
  { id: 'Earthquake', label: 'Earthquake', icon: Globe, color: 'from-amber-700 to-yellow-800', border: 'border-amber-600/50' },
  { id: 'Building Collapse', label: 'Collapse', icon: Building2, color: 'from-slate-600 to-stone-700', border: 'border-slate-500/50' },
  { id: 'Electrical Emergency', label: 'Electrical', icon: Zap, color: 'from-yellow-500 to-amber-600', border: 'border-yellow-500/50' },
  { id: 'Crime/Security', label: 'Security', icon: ShieldAlert, color: 'from-purple-600 to-indigo-700', border: 'border-purple-500/50' },
  { id: 'Cyclone/Storm', label: 'Storm', icon: Wind, color: 'from-teal-600 to-emerald-700', border: 'border-teal-500/50' },
  { id: 'Other', label: 'Other Hazard', icon: AlertTriangle, color: 'from-slate-700 to-slate-800', border: 'border-slate-600/50' }
];

export default function CitizenSOSPortal({ onReportSubmit, myReports, isOnline }) {
  const [selectedCategory, setSelectedCategory] = useState('Road Accident');
  const [description, setDescription] = useState('');
  const [peopleAffected, setPeopleAffected] = useState(2);
  const [injuries, setInjuries] = useState(true);
  const [trapped, setTrapped] = useState(false);
  const [firePresent, setFirePresent] = useState(false);
  
  // Location State — Defaulting to Nagpur Center
  const [location, setLocation] = useState({
    lat: NAGPUR_CENTER.lat,
    lng: NAGPUR_CENTER.lng,
    address: 'Sitabuldi Main Road, Nagpur, Maharashtra',
    accuracy: 4.8
  });
  const [isLocating, setIsLocating] = useState(false);

  // Evidence upload simulation state
  const [mediaList, setMediaList] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const videoRef = useRef(null);
  const recordingVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const saveRecordingRef = useRef(false);
  const recordingTimerRef = useRef(null);

  // Fetch Browser GPS Coordinates
  const fetchCurrentLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: Math.round(pos.coords.latitude * 10000) / 10000,
            lng: Math.round(pos.coords.longitude * 10000) / 10000,
            address: `GPS Captured: Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)} (Nagpur Zone)`,
            accuracy: Math.round(pos.coords.accuracy)
          });
          setIsLocating(false);
        },
        (err) => {
          console.warn("GPS access denied, defaulting to Nagpur hub:", err);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  // A live preview is used instead of relying only on the browser file picker.
  // The stream is always stopped when the dialog closes so the camera indicator turns off.
  useEffect(() => {
    if (!showCamera) return undefined;

    let cancelled = false;
    let stream;

    const startCamera = async () => {
      setCameraError('');
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser does not support live camera access. Use Upload Photo instead.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        const message = error?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
          : 'Unable to start the camera. Check that no other app is using it.';
        setCameraError(message);
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [showCamera]);

  useEffect(() => {
    if (!showVideoRecorder) return undefined;

    let cancelled = false;
    let stream;
    const startVideoCamera = async () => {
      setVideoError('');
      setRecordingSeconds(0);
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setVideoError('Live video recording is not supported in this browser. Use Upload Video instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (recordingVideoRef.current) {
          recordingVideoRef.current.srcObject = stream;
          await recordingVideoRef.current.play();
        }
      } catch (error) {
        setVideoError(error?.name === 'NotAllowedError'
          ? 'Camera or microphone permission was denied. Allow access in browser settings and try again.'
          : 'Unable to start video capture. Check that no other app is using the camera.');
      }
    };
    startVideoCamera();
    return () => {
      clearInterval(recordingTimerRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === 'recording') {
        saveRecordingRef.current = false;
        recorder.stop();
      }
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [showVideoRecorder]);

  const handleEvidenceCapture = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setMediaList((previous) => [
      ...previous,
      ...files.map((file) => ({
        type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
        url: URL.createObjectURL(file),
        tag: `${selectedCategory} ${file.type.startsWith('video/') ? 'Video' : 'Photo'} Evidence`,
        name: file.name,
      })),
    ]);

    // Let the same input be used again after an upload or camera capture.
    event.target.value = '';
  };

  const captureLivePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('The camera is still starting. Please wait a moment and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('The photo could not be captured. Please try again.');
        return;
      }
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMediaList((previous) => [
        ...previous,
        {
          type: 'IMAGE',
          url: URL.createObjectURL(blob),
          tag: `${selectedCategory} Live Camera Photo`,
          name: `live-photo-${Date.now()}.jpg`,
          capturedAt: timestamp,
        },
      ]);
      setShowCamera(false);
    }, 'image/jpeg', 0.9);
  };

  const startLiveVideoRecording = () => {
    const stream = recordingVideoRef.current?.srcObject;
    if (!stream) {
      setVideoError('The camera is still starting. Please wait a moment and try again.');
      return;
    }
    try {
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      saveRecordingRef.current = true;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearInterval(recordingTimerRef.current);
        if (saveRecordingRef.current && recordedChunksRef.current.length) {
          const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
          setMediaList((previous) => [
            ...previous,
            {
              type: 'VIDEO',
              url: URL.createObjectURL(blob),
              tag: `${selectedCategory} Live Video Evidence`,
              name: `live-video-${Date.now()}.webm`,
            },
          ]);
        }
        setIsRecording(false);
        setShowVideoRecorder(false);
      };
      recorder.start(1000);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    } catch {
      setVideoError('Video recording could not start in this browser. Use Upload Video instead.');
    }
  };

  const stopAndSaveLiveVideo = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  const closeVideoRecorder = () => {
    saveRecordingRef.current = false;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setShowVideoRecorder(false);
  };

  const formatRecordingTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const handleTriggerSOS = () => {
    if (!description.trim()) {
      setDescription(`Emergency ${selectedCategory} reported at location. Immediate responder assistance required.`);
    }
    setShowConfirmModal(true);
  };

  const confirmAndSubmit = () => {
    setShowConfirmModal(false);
    
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    const payload = {
      category: selectedCategory,
      title: `${selectedCategory} Emergency Report`,
      description: description || `Emergency ${selectedCategory} reported. Need assistance.`,
      peopleAffected: Number(peopleAffected),
      injuries,
      trapped,
      firePresent,
      location,
      media: mediaList
    };

    onReportSubmit(payload);

    // Reset form
    setDescription('');
    setMediaList([]);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      
      {/* Network Alert Header */}
      {!isOnline && (
        <div className="bg-amber-950/80 border border-amber-500/50 rounded-xl p-4 flex items-center gap-3 text-amber-200 shadow-lg animate-pulse">
          <WifiOff className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <h4 className="font-heading font-bold text-sm">Offline Store & Forward Mode Active</h4>
            <p className="text-xs text-amber-300/80">
              Cellular network unavailable. Your emergency report will be stored locally in IndexedDB & broadcasted via Bluetooth BLE mesh until internet returns.
            </p>
          </div>
        </div>
      )}

      {/* ONE-TAP SOS BUTTON HERO */}
      <div className="glass-panel-accent rounded-2xl p-6 lg:p-8 text-center space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div>
          <span className="px-3 py-1 bg-red-950/80 text-red-400 border border-red-800/80 text-xs font-mono font-bold rounded-full uppercase tracking-wider">
            🚨 Nagpur, Maharashtra Emergency Safety Hub
          </span>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-white mt-2">Emergency Response & SOS Portal</h1>
          <p className="text-slate-300 text-sm max-w-2xl mx-auto mt-1">
            Tap the red SOS button for instant AI priority triaging and nearest volunteer dispatch.
          </p>
        </div>

        {/* Big Pulsing SOS Trigger */}
        <div className="flex justify-center py-4">
          <button
            onClick={handleTriggerSOS}
            className="pulse-sos-btn relative group w-48 h-48 lg:w-56 lg:h-56 rounded-full bg-gradient-to-br from-red-600 via-red-700 to-red-900 border-4 border-red-400/40 text-white font-heading font-black text-2xl lg:text-3xl tracking-widest shadow-2xl flex flex-col items-center justify-center transition-transform active:scale-95 cursor-pointer"
          >
            <ShieldAlert className="w-16 h-16 text-white mb-2 animate-bounce group-hover:scale-110 transition-transform" />
            <span>SEND SOS</span>
            <span className="text-[10px] font-sans font-normal tracking-normal text-red-200 mt-1 opacity-90">
              {isOnline ? 'Direct Cloud Dispatch' : 'IndexedDB & BLE Mesh'}
            </span>
          </button>
        </div>

        {/* Location Status Pill */}
        <div className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-4 py-2 rounded-full text-xs text-slate-300">
          <MapPin className="w-4 h-4 text-red-400" />
          <span>Location: <strong className="text-white">{location.address}</strong></span>
          <button 
            onClick={fetchCurrentLocation}
            className="ml-2 text-blue-400 hover:underline font-mono text-[11px]"
          >
            {isLocating ? 'Locating...' : 'Refresh GPS'}
          </button>
        </div>
      </div>

      {/* DETAILED INCIDENT FORM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Form Inputs */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 space-y-6 border border-slate-800">
          
          <div>
            <h3 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-400" />
              1. Select Emergency Category
            </h3>
            <p className="text-xs text-slate-400 mb-4">Choose the primary hazard category to help AI route the correct emergency team.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer ${
                      isSelected
                        ? `bg-gradient-to-br ${cat.color} text-white border-white/40 shadow-lg scale-105`
                        : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-semibold leading-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description Textarea */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              2. Describe Emergency Situation & Details
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context (e.g. 'Car flipped near Nagpur Airport flyover, 2 injured people inside, smoke coming out')..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-slate-600"
            />
          </div>

          {/* Key Emergency Indicators */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              3. Critical Risk Indicators & Headcount
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                injuries ? 'bg-red-950/60 border-red-500/60 text-red-200' : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={injuries}
                  onChange={(e) => setInjuries(e.target.checked)}
                  className="rounded border-slate-700 text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span className="text-xs font-semibold">Injuries Reported</span>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                trapped ? 'bg-amber-950/60 border-amber-500/60 text-amber-200' : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={trapped}
                  onChange={(e) => setTrapped(e.target.checked)}
                  className="rounded border-slate-700 text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span className="text-xs font-semibold">People Trapped</span>
              </label>

              <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                firePresent ? 'bg-orange-950/60 border-orange-500/60 text-orange-200' : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={firePresent}
                  onChange={(e) => setFirePresent(e.target.checked)}
                  className="rounded border-slate-700 text-orange-600 focus:ring-orange-500 w-4 h-4"
                />
                <span className="text-xs font-semibold">Active Fire / Smoke</span>
              </label>
            </div>

            {/* People Affected Slider */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-400" />
                  Estimated People Affected / At Risk:
                </span>
                <strong className="text-white text-sm bg-blue-950 px-2.5 py-0.5 rounded-md border border-blue-800/60">
                  {peopleAffected} {peopleAffected === 1 ? 'Person' : 'People'}
                </strong>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={peopleAffected}
                onChange={(e) => setPeopleAffected(e.target.value)}
                className="w-full accent-blue-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Evidence capture: mobile browsers open the rear camera; desktop browsers open a file picker. */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              4. Evidence / Photo / Video
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-2 transition-all">
                <Camera className="w-4 h-4 text-red-400" />
                <span>Upload Photo</span>
                <input 
                  type="file" 
                  accept="image/*"
                  multiple
                  onChange={handleEvidenceCapture}
                  className="hidden" 
                />
              </label>
              <button type="button" onClick={() => setShowCamera(true)} className="px-4 py-2.5 bg-red-950/40 hover:bg-red-950/70 text-red-100 border border-red-500/40 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all">
                <ImagePlus className="w-4 h-4 text-red-300" />
                <span>Take Photo</span>
              </button>
              <button type="button" onClick={() => setShowVideoRecorder(true)} className="px-4 py-2.5 bg-blue-950/40 hover:bg-blue-950/70 text-blue-100 border border-blue-500/40 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all">
                <Video className="w-4 h-4 text-blue-300" />
                <span>Record Video</span>
              </button>
              <label className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-2 transition-all">
                <Video className="w-4 h-4 text-blue-300" />
                <span>Upload Video</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleEvidenceCapture}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-slate-500">Camera opens on supported phones; evidence stays attached to this report.</span>
            </div>

            {/* Media Previews */}
            {mediaList.length > 0 && (
              <div className="flex gap-3 pt-2 overflow-x-auto">
                {mediaList.map((m, idx) => (
                  <div key={idx} className="relative w-24 h-20 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 group">
                    {m.type === 'VIDEO' ? (
                      <video src={m.url} controls className="w-full h-full object-cover" aria-label={`Video evidence: ${m.name}`} />
                    ) : (
                      <img src={m.url} alt={`Photo evidence: ${m.name}`} className="w-full h-full object-cover" />
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[9px] text-slate-300 text-center py-0.5 truncate px-1">
                      {m.tag}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleTriggerSOS}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-heading font-bold text-base rounded-xl shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Send className="w-5 h-5" />
            <span>Submit Report & AI Triage Incident</span>
          </button>
        </div>

        {/* Right 1 Col: Live My Incidents Tracker */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                My Incident Tracking ({myReports.length})
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                Nagpur WS Feed
              </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {myReports.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No emergency reports submitted yet.
                </div>
              ) : (
                myReports.map((report) => (
                  <div key={report.id} className="glass-card p-3.5 space-y-2 border-l-4 border-l-red-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-[10px] text-slate-400">{report.id}</span>
                        <h4 className="font-semibold text-xs text-white leading-snug">{report.category}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        report.severity === 'CRITICAL' ? 'badge-critical' :
                        report.severity === 'HIGH' ? 'badge-high' : 'badge-medium'
                      }`}>
                        {report.severity} ({report.priorityScore}/100)
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 line-clamp-2">{report.description}</p>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        Status: <strong className="text-white">{report.status}</strong>
                      </span>
                      <span className="text-slate-500 font-mono">
                        {new Date(report.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Live camera capture dialog */}
      {showCamera && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="camera-title">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h3 id="camera-title" className="font-heading text-lg font-bold text-white">Take live evidence photo</h3>
                <p className="text-xs text-slate-400">Frame the incident, then capture it for this emergency report.</p>
              </div>
              <button type="button" onClick={() => setShowCamera(false)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700">Cancel</button>
            </div>
            <div className="relative aspect-video bg-black">
              {!cameraError && <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" aria-label="Live device camera preview" />}
              {cameraError && <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><Camera className="h-9 w-9 text-red-400" /><p className="max-w-sm text-sm leading-6 text-red-200">{cameraError}</p></div>}
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="text-[11px] text-slate-500">Camera access is used only while this dialog is open.</span>
              <button type="button" onClick={captureLivePhoto} disabled={Boolean(cameraError)} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"><Camera className="h-4 w-4" /> Capture photo</button>
            </div>
          </div>
        </div>
      )}

      {/* Live video capture dialog */}
      {showVideoRecorder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="video-title">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h3 id="video-title" className="font-heading text-lg font-bold text-white">Record live video evidence</h3>
                <p className="text-xs text-slate-400">Record a short incident video with camera and microphone audio.</p>
              </div>
              <button type="button" onClick={closeVideoRecorder} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700">Cancel</button>
            </div>
            <div className="relative aspect-video bg-black">
              {!videoError && <video ref={recordingVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" aria-label="Live video recording preview" />}
              {isRecording && <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 font-mono text-xs font-bold text-white shadow-lg"><span className="h-2 w-2 rounded-full bg-white animate-pulse" /> REC {formatRecordingTime(recordingSeconds)}</span>}
              {videoError && <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><Video className="h-9 w-9 text-red-400" /><p className="max-w-sm text-sm leading-6 text-red-200">{videoError}</p></div>}
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="text-[11px] text-slate-500">Video is attached only after you stop and save it.</span>
              {isRecording ? (
                <button type="button" onClick={stopAndSaveLiveVideo} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-red-500"><span className="h-2.5 w-2.5 rounded-sm bg-white" /> Stop & attach video</button>
              ) : (
                <button type="button" onClick={startLiveVideoRecording} disabled={Boolean(videoError)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><Video className="h-4 w-4" /> Start recording</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel-accent max-w-lg w-full rounded-2xl p-6 border border-red-500/40 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-red-500/30 pb-3">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-bounce" />
              <div>
                <h3 className="font-heading font-extrabold text-lg text-white">Confirm Emergency Submission</h3>
                <p className="text-xs text-red-200">Nagpur Public Safety AI Dispatch System</p>
              </div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl text-xs space-y-2 border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <strong className="text-white">{selectedCategory}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="text-white text-right max-w-[250px] truncate">{location.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Affected Headcount:</span>
                <strong className="text-white">{peopleAffected} people</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dispatch Uplink:</span>
                <strong className={isOnline ? 'text-emerald-400' : 'text-amber-400 font-mono'}>
                  {isOnline ? 'Direct Cloud REST / WS' : 'IndexedDB Store & BLE Mesh'}
                </strong>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndSubmit}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-red-900/40"
              >
                CONFIRM & DISPATCH SOS
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
