import React, { useMemo, useState } from 'react';
import { Ambulance, Box, Building2, MapPin, Plus, Search, ShieldCheck, Truck, Waves } from 'lucide-react';

const RESOURCE_TYPES = ['Ambulance', 'Fire vehicle', 'First-aid kit', 'Medical equipment', 'Food and water', 'Rescue equipment', 'Shelter', 'Vehicle', 'Other'];

function ResourceIcon({ type }) {
  if (/ambulance|medical|first-aid/i.test(type)) return <Ambulance className="h-5 w-5" />;
  if (/fire|vehicle|truck/i.test(type)) return <Truck className="h-5 w-5" />;
  if (/shelter|food|water/i.test(type)) return <Building2 className="h-5 w-5" />;
  if (/rescue/i.test(type)) return <Waves className="h-5 w-5" />;
  return <Box className="h-5 w-5" />;
}

export default function ResourceManagement({ resources = [], onCreateResource, onUpdateResource }) {
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Ambulance', quantity: '1', ownerOrg: '', contactPhone: '', address: '', lat: '', lng: '', details: '' });
  const filteredResources = useMemo(() => {
    const query = search.trim().toLowerCase();
    return resources.filter((resource) => !query || `${resource.name} ${resource.type} ${resource.ownerOrg || ''} ${resource.location?.address || ''}`.toLowerCase().includes(query));
  }, [resources, search]);
  const availableCount = resources.filter((resource) => resource.status === 'AVAILABLE').length;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (form.name.trim().length < 2) return setError('Enter a resource name.');
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return setError('Enter valid latitude and longitude to place this resource on the map.');
    setIsSaving(true);
    try {
      const created = await onCreateResource({
        name: form.name.trim(),
        type: form.type,
        quantity: Math.max(1, Number(form.quantity) || 1),
        capacity: Math.max(1, Number(form.quantity) || 1),
        status: 'AVAILABLE',
        ownerOrg: form.ownerOrg.trim(),
        contactPhone: form.contactPhone.trim(),
        details: form.details.trim(),
        location: { lat, lng, address: form.address.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}` },
      });
      if (created) {
        setNotice(`${created.name} is registered and available for matching.`);
        setForm({ name: '', type: 'Ambulance', quantity: '1', ownerOrg: '', contactPhone: '', address: '', lat: '', lng: '', details: '' });
      }
    } catch (createError) {
      setError(createError.message || 'Could not register this resource. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAvailability = async (resource) => {
    const updated = { ...resource, status: resource.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE' };
    try {
      await onUpdateResource(updated);
      setNotice(`${resource.name} marked ${updated.status.toLowerCase()}.`);
      setError('');
    } catch (updateError) {
      setError(updateError.message || 'Could not update resource availability.');
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-10 text-slate-100" aria-labelledby="resource-title">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Management workspace</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4"><div><h1 id="resource-title" className="text-2xl font-extrabold text-white sm:text-3xl">Emergency resources</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Register nearby equipment and support units, keep their availability current, and make them visible to dispatch matching.</p></div><div className="rounded-xl border border-emerald-700/40 bg-emerald-950/40 px-4 py-3"><span className="block text-xs text-emerald-200">Available resources</span><strong className="mt-1 block text-2xl text-white">{availableCount} <small className="text-xs font-medium text-slate-400">/ {resources.length}</small></strong></div></div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950 text-emerald-300"><Plus className="h-5 w-5" /></span><div><h2 className="font-bold text-white">Register a resource</h2><p className="text-xs text-slate-400">A map location is required for dispatch matching.</p></div></div>
          <label className="block text-xs font-semibold text-slate-300">Resource name<input required maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" placeholder="e.g. Community first-aid kit" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-300">Type<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white">{RESOURCE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label className="block text-xs font-semibold text-slate-300">Quantity<input required min="1" max="100000" type="number" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" /></label></div>
          <label className="block text-xs font-semibold text-slate-300">Owner / organization<input maxLength={100} value={form.ownerOrg} onChange={(event) => setForm((current) => ({ ...current, ownerOrg: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" placeholder="Organization or community group" /></label>
          <label className="block text-xs font-semibold text-slate-300">Contact number<input type="tel" maxLength={32} value={form.contactPhone} onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" placeholder="Contact for dispatch" /></label>
          <label className="block text-xs font-semibold text-slate-300">Address or landmark<input maxLength={180} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" placeholder="Neighbourhood or facility" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-300">Latitude<input required type="number" min="-90" max="90" step="any" value={form.lat} onChange={(event) => setForm((current) => ({ ...current, lat: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" /></label><label className="block text-xs font-semibold text-slate-300">Longitude<input required type="number" min="-180" max="180" step="any" value={form.lng} onChange={(event) => setForm((current) => ({ ...current, lng: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white" /></label></div>
          <label className="block text-xs font-semibold text-slate-300">Notes<textarea rows={2} maxLength={500} value={form.details} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Capacity, equipment, or access notes" /></label>
          {error && <p className="rounded-lg border border-red-700/50 bg-red-950/40 p-3 text-xs text-red-200" role="alert">{error}</p>}
          {notice && <p className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 p-3 text-xs text-emerald-200" role="status">{notice}</p>}
          <button type="submit" disabled={isSaving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-50"><Plus className="h-4 w-4" />{isSaving ? 'Registering…' : 'Register resource'}</button>
        </form>

        <section className="space-y-4" aria-labelledby="resource-list-title">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="resource-list-title" className="text-lg font-extrabold text-white">Registered resources</h2><p className="mt-1 text-xs text-slate-400">Set unavailable items aside so dispatch does not recommend them.</p></div><label className="relative min-w-[220px] flex-1 sm:max-w-xs"><span className="sr-only">Search resources</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-white" placeholder="Search resources" /></label></div>
          {!filteredResources.length ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center"><Box className="mx-auto h-8 w-8 text-slate-500" /><p className="mt-3 text-sm font-semibold text-slate-300">No resources match this search.</p><p className="mt-1 text-xs text-slate-500">Register a resource or clear the search to see the current roster.</p></div> : <div className="grid gap-3 md:grid-cols-2">{filteredResources.map((resource) => <article key={resource.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-emerald-300"><ResourceIcon type={resource.type} /></span><div><h3 className="font-bold text-white">{resource.name}</h3><p className="mt-0.5 text-xs text-slate-400">{resource.type} · Qty {resource.quantity ?? resource.capacity ?? 1}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${resource.status === 'AVAILABLE' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-200'}`}>{resource.status || 'AVAILABLE'}</span></div><div className="mt-4 space-y-2 text-xs text-slate-400"><p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300" />{resource.location?.address || `${resource.location?.lat}, ${resource.location?.lng}`}</p>{resource.ownerOrg && <p>{resource.ownerOrg}</p>}{resource.contactPhone && <p>{resource.contactPhone}</p>}{resource.details && <p className="leading-5">{resource.details}</p>}</div><button type="button" onClick={() => toggleAvailability(resource)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-200 hover:bg-slate-800"><ShieldCheck className="h-3.5 w-3.5" />Mark {resource.status === 'AVAILABLE' ? 'unavailable' : 'available'}</button></article>)}</div>}
        </section>
      </div>
    </main>
  );
}
