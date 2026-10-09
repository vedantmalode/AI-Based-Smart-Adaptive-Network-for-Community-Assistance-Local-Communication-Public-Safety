import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, BrainCircuit, Check, Search, ShieldCheck, Trash2, UserRoundCheck, UserRoundX, Users } from 'lucide-react';
import { deleteAdminProfile, fetchAdminProfiles, reviewVolunteerRequest, updateAdminProfileRole } from '../services/localData';

const volunteerTypeLabel = (type) => ({
  MEDICAL_RESPONDER: 'Doctor / Medical responder',
  RESCUE_SQUAD: 'Rescue team',
  OTHER: 'Other',
})[type] || '—';

export default function AdminDashboard({ resources = [], onOpenResources, onOpenAI }) {
  const [profiles, setProfiles] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [reviewingId, setReviewingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [volunteerTypeFilter, setVolunteerTypeFilter] = useState('ALL');
  const userAccessRef = useRef(null);

  const loadProfiles = async () => {
    setLoading(true);
    setError('');
    try { setProfiles(await fetchAdminProfiles()); }
    catch (loadError) { setError(loadError.message || 'Could not load user profiles.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadProfiles(); }, []);
  useEffect(() => {
    const refreshRequests = async () => {
      try { setProfiles(await fetchAdminProfiles()); }
      catch (loadError) { setError(loadError.message || 'Could not refresh volunteer requests.'); }
    };
    const timer = setInterval(refreshRequests, 15000);
    return () => clearInterval(timer);
  }, []);

  const filteredProfiles = useMemo(() => {
    const value = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      const matchesSearch = !value || `${profile.display_name || ''} ${profile.id} ${profile.role} ${profile.volunteer_type || ''}`.toLowerCase().includes(value);
      const isVolunteer = profile.role === 'VOLUNTEER' || profile.requested_role === 'VOLUNTEER';
      const matchesRole = roleFilter === 'ALL' || profile.role === roleFilter;
      const matchesType = volunteerTypeFilter === 'ALL' || (isVolunteer && profile.volunteer_type === volunteerTypeFilter);
      return matchesSearch && matchesRole && matchesType;
    });
  }, [profiles, query, roleFilter, volunteerTypeFilter]);
  const metrics = [
    { title: 'User profiles', value: profiles.length, icon: Users, color: 'text-sky-300' },
    { title: 'Volunteers', value: profiles.filter((profile) => profile.role === 'VOLUNTEER').length, icon: ShieldCheck, color: 'text-emerald-300' },
    { title: 'Citizens', value: profiles.filter((profile) => profile.role === 'CITIZEN').length, icon: Users, color: 'text-amber-300' },
    { title: 'Resources', value: resources.length, icon: Boxes, color: 'text-blue-300' },
  ];

  const changeRole = async (profile, role) => {
    if (role === profile.role) return;
    setSavingId(profile.id);
    setError('');
    setMessage('');
    try {
      const updated = await updateAdminProfileRole(profile.id, role);
      setProfiles((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`${updated.display_name || 'User'} access changed to ${role}.`);
    } catch (updateError) {
      setError(updateError.message || 'Could not update this role.');
    } finally { setSavingId(''); }
  };

  const reviewRequest = async (profile, decision) => {
    setReviewingId(profile.id);
    setError('');
    setMessage('');
    try {
      const updated = await reviewVolunteerRequest(profile.id, decision);
      setProfiles((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(decision === 'APPROVE'
        ? `${updated.display_name || 'Volunteer'} approved. They can sign out and back in to activate Volunteer access.`
        : `${updated.display_name || 'Volunteer'} request declined.`);
    } catch (reviewError) {
      setError(reviewError.message || 'Could not review this volunteer request.');
    } finally { setReviewingId(''); }
  };

  const deleteProfile = async (profile) => {
    const name = profile.display_name || profile.id;
    if (!window.confirm(`Delete the account for ${name}? This also removes its volunteer profile and access. Existing incident records will remain.`)) return;
    setDeletingId(profile.id);
    setError('');
    setMessage('');
    try {
      await deleteAdminProfile(profile.id);
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      setMessage(`${name} account deleted.`);
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this account.');
    } finally { setDeletingId(''); }
  };

  const volunteerRequests = profiles.filter((profile) => profile.requested_role === 'VOLUNTEER' && profile.request_status === 'PENDING');
  const openVolunteers = () => {
    setRoleFilter('VOLUNTEER');
    setVolunteerTypeFilter('ALL');
    setQuery('');
    requestAnimationFrame(() => userAccessRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-10" aria-labelledby="admin-title">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">Management workspace</p><h1 id="admin-title" className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">Management and system access</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Review responder requests, manage user access and response resources, and coordinate incidents from the command tools.</p></header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="System counts">{metrics.map(({ title, value, icon: Icon, color }) => title === 'Volunteers' ? <button key={title} type="button" onClick={openVolunteers} aria-label={`Show all ${value} volunteers`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-emerald-600/70 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"><span className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-400">{title}</span><Icon className={`h-4 w-4 ${color}`} /></span><span className="mt-2 block text-3xl font-extrabold tabular-nums text-white">{value}</span><span className="mt-1 block text-[10px] text-emerald-300">View volunteers →</span></button> : <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center justify-between"><h2 className="text-xs font-semibold text-slate-400">{title}</h2><Icon className={`h-4 w-4 ${color}`} /></div><p className="mt-2 text-3xl font-extrabold tabular-nums text-white">{value}</p></article>)}</section>

      <section className="rounded-2xl border border-amber-800/50 bg-slate-900/70 p-5 sm:p-6" aria-labelledby="volunteer-requests-title">
        <div className="flex items-center justify-between gap-3"><div><h2 id="volunteer-requests-title" className="text-lg font-extrabold text-white">Volunteer account requests</h2><p className="mt-1 text-xs text-slate-400">Review the responder type before granting Volunteer dashboard access.</p></div><div className="flex items-center gap-2"><button type="button" onClick={loadProfiles} disabled={loading} className="min-h-9 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">Refresh</button><span className="rounded-full border border-amber-700/50 bg-amber-950/40 px-3 py-1 text-xs font-bold text-amber-200">{volunteerRequests.length} pending</span></div></div>
        {loading ? <p className="py-8 text-center text-sm text-slate-400">Loading requests…</p> : volunteerRequests.length ? <div className="mt-4 space-y-3">{volunteerRequests.map((profile) => <article key={profile.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center"><div><h3 className="font-bold text-white">{profile.display_name || 'Unnamed volunteer'}</h3><p className="mt-1 break-all text-xs text-slate-400">{profile.id}</p><p className="mt-1 text-xs font-semibold text-cyan-200">Type: {volunteerTypeLabel(profile.volunteer_type)}</p></div><div className="flex gap-2"><button type="button" disabled={reviewingId === profile.id} onClick={() => reviewRequest(profile, 'REJECT')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-800/70 px-3 text-xs font-bold text-red-200 hover:bg-red-950/50 disabled:opacity-50"><UserRoundX className="h-4 w-4" />Reject</button><button type="button" disabled={reviewingId === profile.id} onClick={() => reviewRequest(profile, 'APPROVE')} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"><UserRoundCheck className="h-4 w-4" />{reviewingId === profile.id ? 'Saving…' : 'Approve volunteer'}</button></div></article>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-6 text-center"><Check className="mx-auto h-5 w-5 text-emerald-300" /><p className="mt-2 text-sm font-semibold text-slate-300">No volunteer requests need review.</p></div>}
      </section>

      <section ref={userAccessRef} className="scroll-mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold text-white">User access</h2><p className="mt-1 text-xs text-slate-400">Account IDs are shown in full so you can address a private message.</p></div><label className="relative min-w-[220px] flex-1 sm:max-w-sm"><span className="sr-only">Search users</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-white" placeholder="Search name, ID, or role" /></label></div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-400">Role <select aria-label="Filter users by role" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); if (event.target.value !== 'VOLUNTEER') setVolunteerTypeFilter('ALL'); }} className="ml-1 min-h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white"><option value="ALL">All roles</option><option value="VOLUNTEER">Volunteer</option><option value="CITIZEN">Citizen</option></select></label>
          <label className="text-[11px] font-semibold text-slate-400">Volunteer type <select aria-label="Filter volunteers by type" value={volunteerTypeFilter} onChange={(event) => setVolunteerTypeFilter(event.target.value)} className="ml-1 min-h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white"><option value="ALL">All types</option><option value="MEDICAL_RESPONDER">Doctor / Medical responder</option><option value="RESCUE_SQUAD">Rescue team</option><option value="OTHER">Other</option></select></label>
          {(roleFilter !== 'ALL' || volunteerTypeFilter !== 'ALL') && <button type="button" onClick={() => { setRoleFilter('ALL'); setVolunteerTypeFilter('ALL'); }} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-sky-300 hover:bg-slate-800">Show all users</button>}
          <span className="ml-auto text-[11px] text-slate-500">{filteredProfiles.length} shown</span>
        </div>
        {error && <p className="mt-4 rounded-xl border border-red-700/50 bg-red-950/40 p-3 text-xs text-red-200" role="alert">{error} <button type="button" onClick={loadProfiles} className="ml-2 font-bold underline">Retry</button></p>}
        {message && <p className="mt-4 rounded-xl border border-emerald-700/50 bg-emerald-950/40 p-3 text-xs text-emerald-200" role="status">{message}</p>}
        {loading ? <p className="py-10 text-center text-sm text-slate-400">Loading user profiles…</p> : filteredProfiles.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Name</th><th className="px-3 py-3">Account ID</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Volunteer type</th><th className="px-3 py-3">Request</th><th className="px-3 py-3">Access</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-800">{filteredProfiles.map((profile) => <tr key={profile.id}><td className="px-3 py-3 font-semibold text-white">{profile.display_name || 'Unnamed user'}</td><td className="max-w-64 break-all px-3 py-3 font-mono text-[10px] text-slate-400">{profile.id}</td><td className="px-3 py-3 text-xs text-slate-300">{profile.role === 'MANAGEMENT' ? 'Management room' : profile.role}</td><td className="px-3 py-3 text-xs text-slate-300">{profile.role === 'VOLUNTEER' || profile.requested_role === 'VOLUNTEER' ? volunteerTypeLabel(profile.volunteer_type) : '—'}</td><td className="px-3 py-3 text-xs text-slate-400">{profile.request_status === 'PENDING' ? 'Volunteer request pending' : profile.request_status === 'REJECTED' ? 'Volunteer request declined' : profile.request_status === 'APPROVED' ? 'Volunteer approved' : '—'}</td><td className="px-3 py-3"><select aria-label={`Change role for ${profile.display_name || profile.id}`} value={profile.role} disabled={savingId === profile.id || profile.request_status === 'PENDING' || profile.role === 'MANAGEMENT'} onChange={(event) => changeRole(profile, event.target.value)} className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white disabled:opacity-50"><option value="CITIZEN">Citizen</option>{profile.role === 'VOLUNTEER' && <option value="VOLUNTEER">Volunteer</option>}{profile.role === 'MANAGEMENT' && <option value="MANAGEMENT">Management room</option>}</select></td><td className="px-3 py-3"><button type="button" disabled={profile.role === 'MANAGEMENT' || deletingId === profile.id} onClick={() => deleteProfile(profile)} aria-label={`Delete account for ${profile.display_name || profile.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-800/70 px-2.5 text-xs font-semibold text-red-200 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />{deletingId === profile.id ? 'Deleting…' : 'Delete'}</button></td></tr>)}</tbody></table></div> : !loading && <p className="py-10 text-center text-sm text-slate-400">No user profiles match this search.</p>}
      </section>

      <div className="grid gap-4 sm:grid-cols-2"><button type="button" onClick={onOpenResources} className="flex min-h-28 items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-left transition hover:border-emerald-700"><span><span className="block font-bold text-white">Manage resources</span><span className="mt-1 block text-xs text-slate-400">Register support units and update availability.</span></span><Boxes className="h-6 w-6 text-emerald-300" /></button><button type="button" onClick={onOpenAI} className="flex min-h-28 items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-left transition hover:border-violet-700"><span><span className="block font-bold text-white">AI model review</span><span className="mt-1 block text-xs text-slate-400">Inspect the transparent priority prototype and demo metrics.</span></span><BrainCircuit className="h-6 w-6 text-violet-300" /></button></div>
      <p className="text-xs leading-5 text-slate-500">The Management room is provisioned locally. Citizen accounts can only receive Volunteer access after a volunteer request is approved.</p>
    </main>
  );
}
