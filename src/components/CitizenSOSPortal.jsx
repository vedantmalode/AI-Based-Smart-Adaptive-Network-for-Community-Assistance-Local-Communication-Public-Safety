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
  WifiOff,
  Navigation2,
  PhoneCall,
  Mic,
  MicOff,
} from 'lucide-react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { predictIncident } from '../services/nlpEngine';
import { useLanguage } from '../contexts/LanguageContext';
import { getEmergencyGuidance } from '../services/firstAidAssistant';
import CitizenConnectivityIndicator from './CitizenConnectivityIndicator';

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

const SOS_COPY = {
  en: { title: 'Emergency Response & SOS Portal', send: 'SEND SOS', call: 'Call 112', categories: ['Fire', 'Medical', 'Accident', 'Flood', 'Earthquake', 'Collapse', 'Electrical', 'Security', 'Storm', 'Other Hazard'] },
  hi: { title: 'आपातकालीन सहायता और SOS', send: 'SOS भेजें', call: '112 पर कॉल करें', categories: ['आग', 'चिकित्सा', 'दुर्घटना', 'बाढ़', 'भूकंप', 'इमारत ढहना', 'बिजली', 'सुरक्षा', 'तूफान', 'अन्य खतरा'] },
  mr: { title: 'आपत्कालीन मदत आणि SOS', send: 'SOS पाठवा', call: '112 वर कॉल करा', categories: ['आग', 'वैद्यकीय', 'अपघात', 'पूर', 'भूकंप', 'इमारत कोसळणे', 'वीज', 'सुरक्षा', 'वादळ', 'इतर धोका'] },
  bn: { title: 'জরুরি সহায়তা ও SOS', send: 'SOS পাঠান', call: '112-এ কল করুন', categories: ['আগুন', 'চিকিৎসা', 'দুর্ঘটনা', 'বন্যা', 'ভূমিকম্প', 'ভবন ধস', 'বিদ্যুৎ', 'নিরাপত্তা', 'ঝড়', 'অন্যান্য বিপদ'] },
  gu: { title: 'કટોકટી સહાય અને SOS', send: 'SOS મોકલો', call: '112 પર કૉલ કરો', categories: ['આગ', 'તબીબી', 'અકસ્મત', 'પૂર', 'ભૂકંપ', 'મકાન ધરાશાયી', 'વીજળી', 'સુરક્ષા', 'વાવાઝોડું', 'અન્ય જોખમ'] },
  ta: { title: 'அவசர உதவி மற்றும் SOS', send: 'SOS அனுப்பு', call: '112 அழைக்கவும்', categories: ['தீ', 'மருத்துவம்', 'விபத்து', 'வெள்ளம்', 'நிலநடுக்கம்', 'கட்டிடம் இடிவு', 'மின்சாரம்', 'பாதுகாப்பு', 'புயல்', 'மற்ற ஆபத்து'] },
  te: { title: 'అత్యవసర సహాయం మరియు SOS', send: 'SOS పంపండి', call: '112కు కాల్ చేయండి', categories: ['అగ్ని', 'వైద్య', 'ప్రమాదం', 'వరద', 'భూకంపం', 'భవనం కూలడం', 'విద్యుత్', 'భద్రత', 'తుఫాను', 'ఇతర ప్రమాదం'] },
};

// A location can only be submitted when both coordinates are within map bounds.
function hasValidCoordinates(location) {
  return Number.isFinite(location?.lat) && location.lat >= -90 && location.lat <= 90
    && Number.isFinite(location?.lng) && location.lng >= -180 && location.lng <= 180;
}

// Keep the AI preview inputs in one place so the form and review use the same values.
function buildPriorityPreview({ category, description, peopleAffected, peopleCountKnown, injuries, trapped, firePresent, location, existingIncidents }) {
  return predictIncident({
    category,
    description,
    peopleAffected: Number(peopleAffected),
    peopleAffectedKnown: peopleCountKnown,
    injuries,
    trapped,
    firePresent,
    location,
    existingIncidents,
  });
}

// Use Indian locale variants for speech input, with English as the fallback.
function getSpeechLocale(language) {
  const locales = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
  return locales[language] || locales.en;
}

export default function CitizenSOSPortal({ onReportSubmit, myReports, isOnline, initialCategory = 'Road Accident', initialLocation = null }) {
  const { language } = useLanguage();
  const copy = SOS_COPY[language] || SOS_COPY.en;

  // Form state covers incident details, location, evidence, and user feedback.
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [description, setDescription] = useState('');
  const [peopleAffected, setPeopleAffected] = useState(2);
  const [peopleCountKnown, setPeopleCountKnown] = useState(true);
  const [injuries, setInjuries] = useState(true);
  const [trapped, setTrapped] = useState(false);
  const [firePresent, setFirePresent] = useState(false);
  const [reportStep, setReportStep] = useState(1);
  const [voiceLanguage, setVoiceLanguage] = useState(['en', 'hi', 'mr'].includes(language) ? language : 'en');
  
  // Never substitute a demo hub for the reporter's real location.
  const [location, setLocation] = useState(() => initialLocation || {
    lat: null,
    lng: null,
    address: '',
    accuracy: null,
    capturedAt: null,
    source: 'manual',
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Evidence attachments stay in device memory until the report is saved locally or uploaded.
  const [mediaList, setMediaList] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('READY');
  const [trackedReportId, setTrackedReportId] = useState('');
  const [voiceState, setVoiceState] = useState({ state: 'idle', message: '' });
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isVoiceNoteRecording, setIsVoiceNoteRecording] = useState(false);
  const [voiceNoteSeconds, setVoiceNoteSeconds] = useState(0);
  const [voiceNoteError, setVoiceNoteError] = useState('');
  const speechRecognitionRef = useRef(null);
  const voiceNoteRecorderRef = useRef(null);
  const voiceNoteStreamRef = useRef(null);
  const voiceNoteChunksRef = useRef([]);
  const voiceNoteTimerRef = useRef(null);
  const videoRef = useRef(null);
  const recordingVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const saveRecordingRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const hasValidLocation = hasValidCoordinates(location);
  const canUseBrowserSpeech = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const priorityPreview = buildPriorityPreview({
    category: selectedCategory,
    description,
    peopleAffected,
    peopleCountKnown,
    injuries,
    trapped,
    firePresent,
    location,
    existingIncidents: myReports,
  });
  const emergencyGuidance = getEmergencyGuidance(selectedCategory);

  // Stop timers and release the microphone when the report form unmounts.
  useEffect(() => () => {
    clearInterval(voiceNoteTimerRef.current);
    const recorder = voiceNoteRecorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    voiceNoteStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // Receive speech text and voice state events from native or browser speech input.
  useEffect(() => {
    const onVoiceState = (event) => setVoiceState(event.detail || { state: 'idle', message: '' });
    const onVoiceText = (event) => {
      const recognized = String(event.detail || '').trim();
      if (!recognized) return;
      setDescription((current) => `${current.trim()} ${recognized}`.trim().slice(0, 2000));
    };
    window.addEventListener('resqnet:voice-state', onVoiceState);
    window.addEventListener('resqnet:voice-text', onVoiceText);
    return () => {
      window.removeEventListener('resqnet:voice-state', onVoiceState);
      window.removeEventListener('resqnet:voice-text', onVoiceText);
      const recognition = speechRecognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.abort();
        speechRecognitionRef.current = null;
      }
    };
  }, []);

  // Track native BLE relay and server-confirmation events for this report.
  useEffect(() => {
    const handleBleStatus = (event) => {
      if (!trackedReportId) return;
      const report = (event.detail?.deliveryStatuses || []).find((item) => item.messageId === trackedReportId);
      if (report?.status === 'SERVER_CONFIRMED') setDeliveryStatus('SERVER_RECEIVED');
      else if (report?.status === 'RELAYED') setDeliveryStatus('RELAYING');
    };
    window.addEventListener('resqnet:ble-status', handleBleStatus);
    return () => window.removeEventListener('resqnet:ble-status', handleBleStatus);
  }, [trackedReportId]);

  // Reflect later server syncs in the delivery badge for queued reports.
  useEffect(() => {
    if (!trackedReportId) return;
    const report = myReports.find((item) => item.clientUuid === trackedReportId);
    if (report && !['PENDING_SYNC', 'QUEUED', 'RELAYING'].includes(report.status)) setDeliveryStatus('SERVER_RECEIVED');
  }, [myReports, trackedReportId]);

  // Start or stop speech-to-text, preferring native recognition on Android.
  const handleVoiceInput = () => {
    const bridge = window.ResQNetNative;
    if (bridge?.startVoiceInput) {
      if (voiceState.state === 'listening') bridge.stopVoiceInput();
      else bridge.startVoiceInput(voiceLanguage);
      return;
    }

    const BrowserSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!BrowserSpeechRecognition) {
      setVoiceState({ state: 'error', message: 'Voice input is not supported in this browser.' });
      return;
    }
    if (speechRecognitionRef.current && voiceState.state === 'listening') {
      speechRecognitionRef.current.stop();
      return;
    }

    const recognition = new BrowserSpeechRecognition();
    recognition.lang = getSpeechLocale(voiceLanguage);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || []).map((result) => result[0]?.transcript || '').join(' ').trim();
      if (transcript) {
        setDescription((current) => `${current.trim()} ${transcript}`.trim().slice(0, 2000));
        setVoiceState({ state: 'idle', message: 'Speech added to the description.' });
      }
    };
    recognition.onerror = (event) => setVoiceState({
      state: 'error',
      message: event.error === 'not-allowed'
        ? 'Microphone permission was denied. Allow microphone access and try again.'
        : event.error === 'no-speech'
          ? 'No speech was detected. Try speaking again.'
          : 'Voice input stopped. Please try again.',
    });
    recognition.onend = () => {
      speechRecognitionRef.current = null;
      setVoiceState((current) => current.state === 'error' ? current : { state: 'idle', message: current.message || 'Voice input stopped.' });
    };
    speechRecognitionRef.current = recognition;
    setVoiceState({ state: 'listening', message: 'Listening… speak now.' });
    try { recognition.start(); }
    catch {
      speechRecognitionRef.current = null;
      setVoiceState({ state: 'error', message: 'Could not start voice input. Try again.' });
    }
  };

  // Stop the voice-note recorder; its data handler saves the resulting audio.
  const stopVoiceNoteRecording = () => {
    if (voiceNoteRecorderRef.current?.state === 'recording') voiceNoteRecorderRef.current.stop();
  };

  // Record an audio attachment when speaking directly into the text field is unsuitable.
  const startVoiceNoteRecording = async () => {
    setVoiceNoteError('');
    setVoiceNoteSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceNoteError('Voice recording is not supported here. Try Chrome or use Upload Audio in evidence.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceNoteStreamRef.current = stream;
      const preferredMimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((mimeType) => window.MediaRecorder.isTypeSupported?.(mimeType));
      const recorder = preferredMimeType
        ? new window.MediaRecorder(stream, { mimeType: preferredMimeType })
        : new window.MediaRecorder(stream);
      voiceNoteRecorderRef.current = recorder;
      voiceNoteChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) voiceNoteChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setVoiceNoteError('The voice note could not be recorded. Check microphone access and try again.');
        setIsVoiceNoteRecording(false);
      };
      recorder.onstop = () => {
        clearInterval(voiceNoteTimerRef.current);
        stream.getTracks().forEach((track) => track.stop());
        voiceNoteStreamRef.current = null;
        if (voiceNoteChunksRef.current.length) {
          const mimeType = recorder.mimeType || voiceNoteChunksRef.current[0]?.type || 'audio/webm';
          const blob = new Blob(voiceNoteChunksRef.current, { type: mimeType });
          const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
          setMediaList((previous) => [...previous, {
            type: 'AUDIO', url: URL.createObjectURL(blob), blob,
            tag: `${selectedCategory} Voice Note`, name: `voice-note-${Date.now()}.${extension}`,
          }]);
          setVoiceNoteError('Voice note saved with this report. Play it in the evidence section before submitting.');
        } else {
          setVoiceNoteError('No audio was captured. Check microphone access and record again.');
        }
        voiceNoteChunksRef.current = [];
        setIsVoiceNoteRecording(false);
      };
      recorder.start(500);
      setIsVoiceNoteRecording(true);
      voiceNoteTimerRef.current = setInterval(() => setVoiceNoteSeconds((seconds) => seconds + 1), 1000);
    } catch (error) {
      voiceNoteStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceNoteStreamRef.current = null;
      setVoiceNoteError(error?.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow microphone access in browser settings, then try again.'
        : 'Could not start voice recording. Check your microphone and try again.');
    }
  };

  // Request a fresh GPS fix and preserve its accuracy and capture time.
  const fetchCurrentLocation = () => {
    setLocationError('');
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: `GPS coordinates ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
            accuracy: Math.round(pos.coords.accuracy),
            capturedAt: new Date().toISOString(),
            source: 'gps',
          });
          setIsLocating(false);
        },
        (err) => {
          const message = err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Enter coordinates and an address manually to continue.'
            : 'Could not get a GPS fix. Retry or enter the location manually.';
          setLocationError(message);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
      );
    } else {
      setLocationError('This browser does not support GPS. Enter the location manually to continue.');
      setIsLocating(false);
    }
  };

  // Use a location passed from the home SOS screen; otherwise request GPS.
  useEffect(() => {
    if (!hasValidCoordinates(initialLocation)) fetchCurrentLocation();
  }, []);

  // Mark any user-edited coordinate or address as manually entered.
  const updateManualLocation = (field, value) => {
    setLocation((current) => ({
      ...current,
      [field]: value,
      accuracy: null,
      capturedAt: new Date().toISOString(),
      source: 'manual',
    }));
  };

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

  // Add selected photo or video files to this incident's evidence list.
  const handleEvidenceCapture = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setMediaList((previous) => [
      ...previous,
      ...files.map((file) => ({
        type: file.type.startsWith('video/') ? 'VIDEO' : file.type.startsWith('audio/') ? 'AUDIO' : 'IMAGE',
        url: URL.createObjectURL(file),
        blob: file,
        tag: `${selectedCategory} ${file.type.startsWith('video/') ? 'Video' : file.type.startsWith('audio/') ? 'Voice Note' : 'Photo'} Evidence`,
        name: file.name,
      })),
    ]);

    // Let the same input be used again after an upload or camera capture.
    event.target.value = '';
  };

  // Save a still image from the current camera preview.
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
          blob,
          tag: `${selectedCategory} Live Camera Photo`,
          name: `live-photo-${Date.now()}.jpg`,
          capturedAt: timestamp,
        },
      ]);
      setShowCamera(false);
    }, 'image/jpeg', 0.9);
  };

  // Start a video recording and update the visible duration timer.
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
              blob,
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

  // Finish the video recording and let the recorder event save its media blob.
  const stopAndSaveLiveVideo = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  // Close video capture and release the camera stream.
  const closeVideoRecorder = () => {
    saveRecordingRef.current = false;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setShowVideoRecorder(false);
  };

  // Format a recording timer as minutes and seconds.
  const formatRecordingTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  // Require valid coordinates before allowing the final SOS confirmation.
  const handleTriggerSOS = () => {
    if (!hasValidLocation) {
      setReportStep(2);
      setLocationError('Set a GPS location or enter coordinates manually before sending this report.');
      setSubmissionError('Add a valid report location before sending.');
      return;
    }
    setSubmissionError('');
    if (!description.trim()) {
      setDescription(`Emergency ${selectedCategory} reported at location. Immediate responder assistance required.`);
    }
    setShowConfirmModal(true);
  };

  // Submit the report after the user reviews and confirms its contents.
  const confirmAndSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionMessage('');
    setSubmissionError('');

    const payload = {
      category: selectedCategory,
      title: `${selectedCategory} Emergency Report`,
      description: description || `Emergency ${selectedCategory} reported. Need assistance.`,
      peopleAffected: Number(peopleAffected),
      peopleAffectedKnown: peopleCountKnown,
      injuries,
      trapped,
      firePresent,
      location,
      media: mediaList
    };

    try {
      const result = await onReportSubmit(payload);
      mediaList.forEach((item) => {
        if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
      });
      setShowConfirmModal(false);
      setSubmissionMessage(result?.queued
        ? 'Report saved on this device. It is queued and has not yet been received by the server.'
        : 'Server received the report. Call 112 as well if you need immediate emergency services.');
      setTrackedReportId(result?.clientUuid || '');
      setDeliveryStatus(result?.queued ? 'QUEUED' : 'SERVER_RECEIVED');
      setDescription('');
      setMediaList([]);
      setVoiceNoteError('');
    } catch (error) {
      setSubmissionError(error?.message || 'The report could not be saved. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render the report form, guidance, attachments, and live delivery feedback.
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      
      {/* Network Alert Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <CitizenConnectivityIndicator isOnline={isOnline} deliveryStatus={deliveryStatus} />
        <a href="tel:112" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-extrabold text-white shadow-lg hover:bg-red-500"><PhoneCall className="h-5 w-5" />Call 112</a>
      </div>
      {!isOnline && (
        <div className="bg-amber-950/80 border border-amber-500/50 rounded-xl p-4 flex items-center gap-3 text-amber-200 shadow-lg">
          <WifiOff className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <h4 className="font-heading font-bold text-sm">Offline Store & Forward Mode Active</h4>
            <p className="text-xs text-amber-300/80">
              Cellular network unavailable. Your report will be stored on this device and queued for sync when internet returns.
            </p>
          </div>
        </div>
      )}

      {(submissionMessage || submissionError) && (
        <div role={submissionError ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${submissionError ? 'border-red-500/40 bg-red-950/50 text-red-200' : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'}`}>
          {submissionError || submissionMessage}
        </div>
      )}

      {/* Emergency identity and the prominent action to review and send an SOS. */}
      <div className="glass-panel-accent rounded-2xl border border-slate-800 p-5 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <div className="min-w-0 flex-1">
          <span className="px-3 py-1 bg-red-950/80 text-red-400 border border-red-800/80 text-xs font-mono font-bold rounded-full uppercase tracking-wider">
            🚨 Nagpur, Maharashtra Emergency Safety Hub
          </span>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-white mt-2">{copy.title}</h1>
          <p className="text-slate-300 text-sm max-w-2xl mx-auto mt-1">
            Send an emergency report with your location and a short description. This local project does not replace official emergency services.
          </p>
        </div>

        {/* Clear SOS action without the oversized halo treatment. */}
        <div className="flex justify-center">
          <button
            onClick={handleTriggerSOS}
            aria-label="Review and send emergency SOS"
            className="group flex min-h-16 min-w-44 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-600 px-7 py-4 text-white font-heading font-extrabold text-xl tracking-wide shadow-lg shadow-red-950/30 transition-colors focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-red-300 active:bg-red-700 hover:bg-red-500"
          >
            <ShieldAlert className="w-5 h-5 text-white" />
            <span>{copy.send}</span>
          </button>
        </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href="tel:112" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-600/50 bg-emerald-950/70 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-900/70">
            <PhoneCall className="h-4 w-4" /> {copy.call}
          </a>
        </div>
        {/* Location Status Pill */}
        <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-300">
          <MapPin className="w-4 h-4 text-red-400" />
          <span>Location: <strong className="text-white">{location.address || locationError || 'Not set yet'}</strong>{hasValidLocation && <span className="block text-slate-400">{location.lat.toFixed(5)}, {location.lng.toFixed(5)} · {location.source === 'gps' ? `±${location.accuracy} m accuracy` : 'manually set'}{location.capturedAt ? ` · ${location.source === 'gps' ? 'Captured' : 'Updated'} ${new Date(location.capturedAt).toLocaleTimeString()}` : ''}</span>}</span>
          <button
            onClick={() => { setReportStep(2); }}
            className="ml-2 text-sky-300 hover:underline font-mono text-[11px]"
          >
            Correct location
          </button>
          <button 
            onClick={fetchCurrentLocation}
            disabled={isLocating}
            className="ml-2 text-blue-400 hover:underline font-mono text-[11px]"
          >
            {isLocating ? 'Locating...' : 'Refresh GPS'}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4" aria-label={`Emergency report step ${reportStep} of 3`}>
        <div className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold text-slate-300"><span>Emergency report</span><span>Step {reportStep} of 3</span></div>
        <div className="grid grid-cols-3 gap-2" aria-hidden="true">{[1, 2, 3].map((step) => <span key={step} className={`h-1.5 rounded-full ${reportStep >= step ? 'bg-red-500' : 'bg-slate-700'}`} />)}</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-slate-400"><span>Emergency details</span><span>Location & evidence</span><span>Review</span></div>
      </section>

      {/* DETAILED INCIDENT FORM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Form Inputs */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 space-y-6 border border-slate-800">
          
          {reportStep === 1 && <div>
            <h3 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-400" />
              Choose an emergency type
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
                    <span className="text-xs font-semibold leading-tight">{copy.categories[CATEGORIES.indexOf(cat)] || cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>}

          {/* Description Textarea */}
          {/* Step one collects incident description, voice input, and safety guidance. */}
          {reportStep === 1 && <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="incident-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Tell us what happened</label>
              <div className="flex flex-wrap gap-2">
                <label className="flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-300">Voice language<select aria-label="Voice SOS language" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value)} className="min-h-8 bg-slate-900 text-white focus:outline-none"><option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option></select></label>
                {(window.ResQNetNative?.startVoiceInput || canUseBrowserSpeech) && <button type="button" onClick={handleVoiceInput} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800" aria-pressed={voiceState.state === 'listening'}>
                  {voiceState.state === 'listening' ? <MicOff className="h-4 w-4 text-red-300" /> : <Mic className="h-4 w-4 text-sky-300" />}
                  {voiceState.state === 'listening' ? 'Stop speech input' : window.ResQNetNative?.startVoiceInput ? 'Speak description' : 'Dictate description'}
                </button>}
                <button type="button" onClick={isVoiceNoteRecording ? stopVoiceNoteRecording : startVoiceNoteRecording} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${isVoiceNoteRecording ? 'border-red-500/60 bg-red-950/60 text-red-100 hover:bg-red-900/70' : 'border-sky-700/70 bg-sky-950/50 text-sky-100 hover:bg-sky-900/60'}`} aria-pressed={isVoiceNoteRecording}>
                  {isVoiceNoteRecording ? <MicOff className="h-4 w-4 text-red-300" /> : <Mic className="h-4 w-4 text-sky-300" />}
                  {isVoiceNoteRecording ? `Stop & save ${formatRecordingTime(voiceNoteSeconds)}` : 'Record voice note'}
                </button>
              </div>
            </div>
            <textarea
              id="incident-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context (e.g. 'Car flipped near Nagpur Airport flyover, 2 injured people inside, smoke coming out')..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-slate-600"
            />
            <p className="text-[11px] leading-5 text-slate-500">You can type instead of speaking. Voice recognition availability depends on this browser or Android speech service; review the transcript before sending.</p>
            {voiceState.message && <p className={`text-xs ${voiceState.state === 'error' ? 'text-red-300' : 'text-sky-200'}`} role={voiceState.state === 'error' ? 'alert' : 'status'}>{voiceState.message}{voiceState.state === 'downloading' && voiceState.percent > 0 ? ` ${voiceState.percent}%` : ''}</p>}
            {voiceNoteError && <p className={`text-xs ${voiceNoteError.includes('denied') || voiceNoteError.includes('could not') || voiceNoteError.includes('No audio') || voiceNoteError.includes('not supported') ? 'text-amber-300' : 'text-emerald-300'}`} role="status">{isVoiceNoteRecording ? `Recording voice note… ${formatRecordingTime(voiceNoteSeconds)}. Press Stop & save when finished.` : voiceNoteError}</p>}
          </div>

          <section className="rounded-xl border border-amber-700/50 bg-amber-950/35 p-4" aria-labelledby="emergency-guidance-title">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="emergency-guidance-title" className="text-sm font-extrabold text-amber-100">{emergencyGuidance.title}</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/90">{emergencyGuidance.text}</p></div><a href="tel:112" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-extrabold text-white hover:bg-red-500"><PhoneCall className="h-4 w-4" />Call 112</a></div>
            <p className="mt-2 text-[10px] leading-4 text-amber-100/65">Basic safety information only. Follow the emergency operator’s directions; this app does not contact 112 for you. {emergencyGuidance.sources.map((source, index) => <React.Fragment key={source.url}><a className="font-semibold underline underline-offset-2" href={source.url} target="_blank" rel="noreferrer">{source.label}</a>{index < emergencyGuidance.sources.length - 1 ? ' · ' : ''}</React.Fragment>)}</p>
          </section>

          {/* Key Emergency Indicators */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              People affected and immediate risks
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
                  {peopleCountKnown ? `${peopleAffected} ${peopleAffected === 1 ? 'Person' : 'People'}` : 'Unknown'}
                </strong>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-400">
                <input type="checkbox" checked={!peopleCountKnown} onChange={(event) => setPeopleCountKnown(!event.target.checked)} className="rounded border-slate-700 text-blue-500" />
                I do not know the number yet
              </label>
              <input
                type="range"
                min={1}
                max={50}
                value={peopleAffected}
                onChange={(e) => setPeopleAffected(e.target.value)}
                disabled={!peopleCountKnown}
                aria-label="Estimated people affected"
                className="w-full accent-blue-500 bg-slate-800 h-2 rounded-lg cursor-pointer disabled:opacity-40"
              />
            </div>
          </div>

          </>}

          {/* Evidence capture: mobile browsers open the rear camera; desktop browsers open a file picker. */}
          {reportStep === 2 && <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Add a photo, video, or voice note (optional)
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
              <label className="px-4 py-2.5 bg-sky-950/40 hover:bg-sky-950/70 text-sky-100 border border-sky-700/50 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all">
                <Mic className="w-4 h-4 text-sky-300" />
                <span>Upload Audio</span>
                <input type="file" accept="audio/*" onChange={handleEvidenceCapture} className="hidden" />
              </label>
              <span className="text-[11px] text-slate-500">Camera opens on supported phones; evidence stays attached to this report.</span>
            </div>

            {/* Media Previews */}
            {mediaList.length > 0 && (
              <div className="flex gap-3 pt-2 overflow-x-auto">
                {mediaList.map((m, idx) => (
                  <div key={idx} className={`relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 group ${m.type === 'AUDIO' ? 'w-64 min-h-20 p-2' : 'w-24 h-20'}`}>
                    {m.type === 'AUDIO' ? (
                      <audio src={m.url} controls className="w-full" aria-label={`Voice note: ${m.name}`} />
                    ) : m.type === 'VIDEO' ? (
                      <video src={m.url} controls className="w-full h-full object-cover" aria-label={`Video evidence: ${m.name}`} />
                    ) : (
                      <img src={m.url} alt={`Photo evidence: ${m.name}`} className="w-full h-full object-cover" />
                    )}
                    <span className={`${m.type === 'AUDIO' ? 'mt-1 block' : 'absolute bottom-0 inset-x-0'} bg-slate-950/80 text-[9px] text-slate-300 text-center py-0.5 truncate px-1`}>
                      {m.tag}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>}

          {/* Step two confirms GPS data or accepts a manually corrected location. */}
          {reportStep === 2 && <section className="space-y-4" aria-labelledby="report-location-title">
            <div><h3 id="report-location-title" className="text-lg font-heading font-bold text-white">Confirm emergency location</h3><p className="mt-1 text-xs leading-5 text-slate-400">GPS is requested automatically. If unavailable, enter coordinates and a nearby address manually.</p></div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-red-400" /><div><p className="text-sm font-bold text-white">{location.address || 'No location selected'}</p><p className="mt-1 text-xs text-slate-400">{hasValidLocation ? `${location.source === 'gps' ? `GPS accuracy ±${location.accuracy} m` : 'Location entered manually'}${location.capturedAt ? ` · ${location.source === 'gps' ? 'Captured' : 'Updated'} ${new Date(location.capturedAt).toLocaleTimeString()}` : ''}` : locationError || 'Location is required to submit this report.'}</p></div></div>
              <button type="button" onClick={fetchCurrentLocation} disabled={isLocating} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-600 px-4 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50"><Navigation2 className="h-4 w-4" />{isLocating ? 'Locating…' : 'Use current location'}</button>
            </div>
            {locationError && <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 p-3 text-xs leading-5 text-amber-200" role="status">{locationError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-300">Latitude<input type="number" inputMode="decimal" min="-90" max="90" step="any" value={location.lat ?? ''} onChange={(event) => updateManualLocation('lat', event.target.value === '' ? null : Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" placeholder="21.1458" /></label>
              <label className="text-xs font-semibold text-slate-300">Longitude<input type="number" inputMode="decimal" min="-180" max="180" step="any" value={location.lng ?? ''} onChange={(event) => updateManualLocation('lng', event.target.value === '' ? null : Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" placeholder="79.0882" /></label>
            </div>
            <label className="block text-xs font-semibold text-slate-300">Nearby address or landmark<input value={location.address} onChange={(event) => updateManualLocation('address', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-600" placeholder="Street, neighbourhood, or landmark" /></label>
            <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800" aria-label="Local map preview; coordinates stay on this device until report submission">
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(45deg, #64748b 1px, transparent 1px), linear-gradient(-45deg, #64748b 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
              {hasValidLocation ? <div className="relative flex flex-col items-center gap-2"><MapPin className="h-9 w-9 fill-red-600 text-red-300 drop-shadow-lg" /><span className="rounded-full bg-slate-950/90 px-3 py-1 text-[11px] font-semibold text-white">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span></div> : <p className="relative rounded-full bg-slate-950/80 px-4 py-2 text-xs text-slate-300">Set a location to place the map pin.</p>}
            </div>
          </section>}

          {/* Step three summarizes the report and explains the AI priority suggestion. */}
          {reportStep === 3 && <section className="space-y-4" aria-labelledby="review-report-title">
            <div><h3 id="review-report-title" className="text-lg font-heading font-bold text-white">Review your report</h3><p className="mt-1 text-xs text-slate-400">Check the details before sending them to responders.</p></div>
            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm">
              <div className="flex justify-between gap-4"><span className="text-slate-400">Emergency</span><strong className="text-right text-white">{selectedCategory}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-slate-400">Description</span><strong className="max-w-[65%] text-right text-white">{description || 'No description provided'}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-slate-400">People affected</span><strong className="text-white">{peopleCountKnown ? peopleAffected : 'Unknown'}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-slate-400">Risks</span><strong className="text-right text-white">{[injuries && 'Injuries', trapped && 'People trapped', firePresent && 'Fire or smoke'].filter(Boolean).join(', ') || 'None reported'}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-slate-400">Location</span><strong className="max-w-[65%] text-right text-white">{location.address || `${location.lat}, ${location.lng}`}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-slate-400">Evidence</span><strong className="text-white">{mediaList.length ? `${mediaList.length} attachment${mediaList.length === 1 ? '' : 's'}` : 'None'}</strong></div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wider text-amber-100">Explainable priority suggestion</span><strong className="rounded-full bg-amber-400/15 px-3 py-1 text-sm text-amber-200">{priorityPreview.priorityBand} · {priorityPreview.severity}</strong></div>
              <p className="mt-2 text-xs font-semibold text-amber-100">AI confidence: {Math.round(priorityPreview.confidence * 100)}%</p>
              <p className="mt-1 text-[10px] leading-4 text-amber-100/60">{priorityPreview.confidenceNote} A responder can review and override this suggestion.</p>
              <div className="mt-3"><p className="text-[11px] font-bold uppercase tracking-wide text-amber-100/80">Why this priority</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-100/80">{priorityPreview.priorityReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
              {priorityPreview.missingInformation.length > 0 && <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-950/50 p-3" role="status"><p className="text-[11px] font-bold uppercase tracking-wide text-amber-200">More information may help responders</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-100/80">{priorityPreview.missingInformation.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              {priorityPreview.reviewFlags.length > 0 && <div className="mt-3 rounded-lg border border-orange-400/30 bg-orange-950/40 p-3" role="status"><p className="text-[11px] font-bold text-orange-200">Please review before sending</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-orange-100/80">{priorityPreview.reviewFlags.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-1 text-[10px] text-orange-100/70">Potential duplicates are flagged for human comparison; reports are never discarded automatically.</p></div>}
              <p className="mt-2 text-[11px] text-amber-100/70">Suggested resources: {priorityPreview.recommendedResources.join(', ').replaceAll('_', ' ')}</p>
            </div>
            {!hasValidLocation && <p role="alert" className="text-xs font-semibold text-red-300">A valid GPS or manually entered location is required before sending.</p>}
          </section>}

          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <button type="button" onClick={() => { setSubmissionError(''); setReportStep((current) => Math.max(1, current - 1)); }} disabled={reportStep === 1} className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40">Back</button>
            {reportStep < 3
              ? <button type="button" onClick={() => { setSubmissionError(''); if (isVoiceNoteRecording) { setVoiceNoteError('Stop and save the voice note before continuing.'); return; } if (reportStep === 2 && !hasValidLocation) { setLocationError('Enter valid latitude and longitude before continuing.'); return; } setReportStep((current) => Math.min(3, current + 1)); }} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-500">Continue</button>
              : <button type="button" onClick={handleTriggerSOS} disabled={!hasValidLocation} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-extrabold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />Review & send report</button>}
          </div>
        </div>

        {/* Track previous submissions and their current response status. */}
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
              {isRecording && <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-700 px-3 py-1.5 font-mono text-xs font-bold text-white shadow-lg"><span className="h-2 w-2 rounded-full bg-white" /> REC {formatRecordingTime(recordingSeconds)}</span>}
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
              <AlertTriangle className="w-8 h-8 text-red-500" />
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
                  {isOnline ? 'Online submission' : 'Device queue'}
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
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-red-900/40 disabled:cursor-wait disabled:opacity-60"
              >
                {isSubmitting ? 'SAVING REPORT…' : 'CONFIRM & SUBMIT REPORT'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
