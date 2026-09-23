import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import GISMapView from './components/GISMapView';
import ResQNetLanding from './components/ResQNetLanding';
import LoginModal from './components/LoginModal';
import { INITIAL_RESOURCES, INITIAL_VOLUNTEERS } from './services/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [userSession, setUserSession] = useState(null);
  const [volunteers, setVolunteers] = useState(() => INITIAL_VOLUNTEERS.map((volunteer) => ({
    ...volunteer,
    status: 'OFFLINE',
    availability: 'Signed out',
  })));
  const [resources, setResources] = useState(INITIAL_RESOURCES);

  const handleLogin = (session) => {
    setUserSession(session);
    setShowLogin(false);
    if (session.role === 'VOLUNTEER') {
      const volunteer = volunteers.find((item) => item.name === session.name);
      if (volunteer) {
        setVolunteers((previous) => previous.map((item) => item.id === volunteer.id
          ? { ...item, status: 'ACTIVE', availability: 'Available Now' }
          : { ...item, status: 'OFFLINE', availability: 'Signed out' }));
      }
      setActiveTab('gis');
    } else {
      setActiveTab('home');
    }
  };
  useEffect(() => {
    const liveTimer = setInterval(() => {
      setResources((previous) => previous.map((resource) => {
        if (!resource.isLiveTracking || resource.status !== 'DISPATCHED') return resource;
        return {
          ...resource,
          location: {
            lat: Math.round((resource.location.lat + (Math.random() - 0.4) * 0.0003) * 10000) / 10000,
            lng: Math.round((resource.location.lng + (Math.random() - 0.4) * 0.0003) * 10000) / 10000,
          },
          speedKmH: Math.round(35 + Math.random() * 15),
        };
      }));
    }, 3000);
    return () => clearInterval(liveTimer);
  }, []);

  useEffect(() => {
    if (userSession?.role !== 'VOLUNTEER' || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (position) => setVolunteers((previous) => previous.map((volunteer) => volunteer.name === userSession.name
        ? { ...volunteer, location: { lat: position.coords.latitude, lng: position.coords.longitude } }
        : volunteer)),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [userSession?.name, userSession?.role]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-red-500 selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOnline={isOnline}
        setIsOnline={setIsOnline}
        userSession={userSession}
        onOpenLogin={() => setShowLogin(true)}
        onLogout={() => {
          if (userSession?.role === 'VOLUNTEER') {
            setVolunteers((previous) => previous.map((volunteer) => volunteer.name === userSession.name
              ? { ...volunteer, status: 'OFFLINE', availability: 'Signed out' }
              : volunteer));
          }
          setUserSession(null);
          setActiveTab('home');
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
        {activeTab === 'home' && <ResQNetLanding onOpenMap={() => setActiveTab('gis')} />}
        {activeTab === 'gis' && <GISMapView resources={resources} volunteers={volunteers} activeVolunteerName={userSession?.role === 'VOLUNTEER' ? userSession.name : null} />}
      </main>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}

      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500 bg-slate-950/60">
        <p>ResQNet — AI-Powered Emergency Resource Management System | Nagpur, Maharashtra Zone | Final Year Engineering Project 2026–2027</p>
      </footer>
    </div>
  );
}
