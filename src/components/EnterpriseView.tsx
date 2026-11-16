import React, { useEffect, useState } from 'react';
import {
  Users,
  Key,
  FileSpreadsheet,
  ShieldCheck,
  Plus,
  Copy,
  Check,
  Activity,
  Lock,
  Loader2,
  Trash2,
  Building,
  X,
} from 'lucide-react';
import type { CompanyKeyApi, CompanyMemberApi, CompanyResponse, PaymentRecord } from '../types';
import { api } from '../lib/api';
import { formatDate } from '../lib/adapters';

interface EnterpriseViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onUserChanged: () => void | Promise<void>;
}

const ROLES = ['Admin', 'Prompt Engineer', 'Diseñador', 'Revisor IP/Legal'];

export const EnterpriseView: React.FC<EnterpriseViewProps> = ({ onShowToast, onUserChanged }) => {
  const [tab, setTab] = useState<'company' | 'members' | 'api' | 'billing'>('company');
  const [company, setCompany] = useState<CompanyResponse | null>(null);
  const [members, setMembers] = useState<CompanyMemberApi[]>([]);
  const [keys, setKeys] = useState<CompanyKeyApi[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    taxId: '',
    billingEmail: '',
    seats: '5',
  });
  const [savingCompany, setSavingCompany] = useState<boolean>(false);
  const [showInvite, setShowInvite] = useState<boolean>(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: ROLES[1] });
  const [inviting, setInviting] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [createdKey, setCreatedKey] = useState<string>('');
  const [creatingKey, setCreatingKey] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api.company.get(),
      api.company.members(),
      api.company.keys(),
      api.billing.payments(),
    ])
      .then(([companyResponse, membersResponse, keysResponse, paymentsResponse]) => {
        if (!alive) return;
        setCompany(companyResponse);
        setCompanyForm({
          name: companyResponse.company.name || '',
          taxId: companyResponse.company.taxId || '',
          billingEmail: companyResponse.company.billingEmail || '',
          seats: String(companyResponse.company.seats || 5),
        });
        setMembers(membersResponse.items);
        setKeys(keysResponse.items);
        setPayments(paymentsResponse.items);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        onShowToast(
          'No se pudo cargar la sección empresa',
          error instanceof Error ? error.message : undefined,
          'error'
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const saveCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCompany(true);
    try {
      const response = await api.company.update({
        name: companyForm.name.trim(),
        taxId: companyForm.taxId.trim(),
        billingEmail: companyForm.billingEmail.trim(),
        seats: Number(companyForm.seats),
      });
      onShowToast('Empresa guardada', response.message, 'success');
      await onUserChanged();
      setReloadKey((key) => key + 1);
    } catch (error) {
      onShowToast(
        'No se pudo guardar la empresa',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setSavingCompany(false);
    }
  };

  const inviteMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviting(true);
    try {
      const response = await api.company.inviteMember({
        name: invite.name.trim(),
        email: invite.email.trim(),
        role: invite.role,
      });
      onShowToast('Invitación enviada', response.message, 'success');
      setShowInvite(false);
      setInvite({ name: '', email: '', role: ROLES[1] });
      setReloadKey((key) => key + 1);
    } catch (error) {
      onShowToast(
        'No se pudo invitar al miembro',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (member: CompanyMemberApi) => {
    try {
      const response = await api.company.deleteMember(member.id);
      onShowToast('Miembro eliminado', response.message, 'success');
      setReloadKey((key) => key + 1);
    } catch (error) {
      onShowToast(
        'No se pudo eliminar al miembro',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    }
  };

  const createKey = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingKey(true);
    try {
      const response = await api.company.createKey(newKeyName.trim());
      setCreatedKey(response.key);
      setNewKeyName('');
      setShowKeyModal(false);
      setReloadKey((key) => key + 1);
      onShowToast('Clave creada', response.message, 'success');
    } catch (error) {
      onShowToast(
        'No se pudo crear la clave',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setCreatingKey(false);
    }
  };

  const copyCreatedKey = async () => {
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopiedKey(true);
      window.setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      onShowToast('No se pudo copiar', 'Copiá la clave manualmente.', 'error');
    }
  };

  const revokeKey = async (key: CompanyKeyApi) => {
    try {
      const nextStatus = key.status === 'Activa' ? 'Revocada' : 'Activa';
      const response = await api.company.updateKey(key.id, nextStatus);
      onShowToast('Clave actualizada', response.message, 'success');
      setReloadKey((reload) => reload + 1);
    } catch (error) {
      onShowToast(
        'No se pudo actualizar la clave',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    }
  };

  const deleteKey = async (key: CompanyKeyApi) => {
    try {
      const response = await api.company.deleteKey(key.id);
      onShowToast('Clave eliminada', response.message, 'success');
      setReloadKey((reload) => reload + 1);
    } catch (error) {
      onShowToast(
        'No se pudo eliminar la clave',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            ENTERPRISE & STUDIO
          </div>
          <h1 className="font-space text-3xl font-extrabold text-slate-900 mt-1">Mi Empresa</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Perfil corporativo persistido, equipo con roles y claves de API con estado real.
          </p>
        </div>
        {company && (
          <span
            className={`self-start px-3 py-1 rounded-full text-[10px] font-mono-code font-bold uppercase ${
              company.isCorporate
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {company.isCorporate ? 'Cuenta corporativa' : 'Cuenta individual'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-purple-100 pb-3 mb-6">
        {[
          { id: 'company' as const, label: 'EMPRESA', icon: Building },
          { id: 'members' as const, label: `EQUIPO (${members.length})`, icon: Users },
          { id: 'api' as const, label: `API KEYS (${keys.length})`, icon: Key },
          { id: 'billing' as const, label: 'FACTURACIÓN', icon: FileSpreadsheet },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold transition flex items-center gap-1.5 ${
              tab === item.id
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" /> {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <p className="text-sm">Cargando datos de empresa…</p>
        </div>
      ) : (
        <>
          {tab === 'company' && (
            <form
              onSubmit={saveCompany}
              className="max-w-2xl bg-white rounded-2xl border border-purple-100 shadow-xs p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Building className="w-4 h-4 text-purple-600" />
                <h2 className="font-space font-bold text-sm text-slate-900">Perfil corporativo</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nombre de la empresa
                  </label>
                  <input
                    value={companyForm.name}
                    onChange={(event) =>
                      setCompanyForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Ej: NeoVisions Studio"
                    className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      CUIT / Tax ID
                    </label>
                    <input
                      value={companyForm.taxId}
                      onChange={(event) =>
                        setCompanyForm((prev) => ({ ...prev, taxId: event.target.value }))
                      }
                      placeholder="30-71234567-8"
                      className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Email de facturación
                    </label>
                    <input
                      value={companyForm.billingEmail}
                      onChange={(event) =>
                        setCompanyForm((prev) => ({ ...prev, billingEmail: event.target.value }))
                      }
                      placeholder="billing@empresa.com"
                      className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Asientos (seats)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={companyForm.seats}
                    onChange={(event) =>
                      setCompanyForm((prev) => ({ ...prev, seats: event.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCompany}
                className="mt-4 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-semibold transition flex items-center gap-2"
              >
                {savingCompany ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {savingCompany ? 'Guardando…' : 'Guardar empresa'}
              </button>

              <div className="mt-4 p-3 rounded-xl bg-purple-50 border border-purple-100 text-[11px] text-purple-900">
                Al guardar, tu cuenta pasa a corporativa y el perfil queda persistido en SQLite.
                Podés invitar miembros y generar API keys.
              </div>
            </form>
          )}

          {tab === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-space font-bold text-sm text-slate-900">Equipo</h2>
                <button
                  onClick={() => setShowInvite(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Invitar miembro
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-purple-100 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-purple-100">
                    <tr className="text-[10px] font-mono-code uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Miembro</th>
                      <th className="px-4 py-3">Rol</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Fórmulas</th>
                      <th className="px-4 py-3">Alta</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-purple-50/40">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{member.name}</div>
                          <div className="text-[10px] text-slate-400">{member.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={member.role}
                            onChange={async (event) => {
                              try {
                                await api.company.updateMember(member.id, { role: event.target.value });
                                onShowToast('Rol actualizado', 'Miembro actualizado.', 'success');
                                setReloadKey((key) => key + 1);
                              } catch (error) {
                                onShowToast(
                                  'No se pudo actualizar',
                                  error instanceof Error ? error.message : undefined,
                                  'error'
                                );
                              }
                            }}
                            className="px-2 py-1 rounded-lg border border-purple-100 bg-slate-50 text-[11px]"
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-mono-code font-bold uppercase ${
                              member.status === 'Activo'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{member.formulasCreated}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(member.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeMember(member)}
                            className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!members.length && (
                  <div className="py-10 text-center text-xs text-slate-400">
                    Todavía no invitaste a nadie. Sumá a tu equipo para colaborar.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'api' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-space font-bold text-sm text-slate-900">Claves de API</h2>
                <button
                  onClick={() => setShowKeyModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Nueva clave
                </button>
              </div>

              <div className="space-y-2">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="p-3 rounded-xl bg-white border border-purple-100 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                      <Key className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900">{key.name}</div>
                      <div className="text-[10px] font-mono-code text-slate-400">
                        {key.maskedKey || `${key.prefix}••••`}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono-code text-slate-500">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" /> {key.totalCalls} calls
                      </span>
                      <span>{formatDate(key.createdAt)}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-mono-code font-bold uppercase ${
                        key.status === 'Activa'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {key.status}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => revokeKey(key)}
                        className="px-2 py-1 rounded-lg border border-purple-200 text-[10px] font-semibold text-slate-600 hover:bg-purple-50"
                      >
                        {key.status === 'Activa' ? 'Revocar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => deleteKey(key)}
                        className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {!keys.length && (
                  <div className="py-10 text-center text-xs text-slate-400 bg-white rounded-2xl border border-purple-100">
                    No hay claves creadas.
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-950 text-white flex items-start gap-2">
                <Lock className="w-4 h-4 text-purple-300 mt-0.5" />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  La clave completa se muestra una sola vez al crearla. Guardala en tu gestor de
                  secretos: la base solo conserva el prefijo.
                </p>
              </div>
            </div>
          )}

          {tab === 'billing' && (
            <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-purple-100 text-[10px] font-mono-code font-bold uppercase tracking-wider text-slate-600">
                Pagos y facturación simulada
              </div>
              {payments.length ? (
                <ul className="divide-y divide-purple-50">
                  {payments.map((payment) => (
                    <li key={payment.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{payment.description}</div>
                        <div className="text-[10px] text-slate-400 font-mono-code">
                          {payment.reference} · {payment.provider} · •••• {payment.last4} ·{' '}
                          {formatDate(payment.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono-code text-slate-900">
                          ${payment.amountUsd.toFixed(2)}
                        </div>
                        <div className="text-[9px] uppercase font-mono-code text-emerald-600">
                          {payment.status}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No hay pagos registrados. Activá un plan o comprá créditos desde Planes.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <form
            onSubmit={inviteMember}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-purple-100 p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-space text-lg font-bold text-slate-900">Invitar miembro</h2>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nombre</label>
            <input
              value={invite.name}
              onChange={(event) => setInvite((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-3"
            />
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email</label>
            <input
              value={invite.email}
              onChange={(event) => setInvite((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-3"
            />
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rol</label>
            <select
              value={invite.role}
              onChange={(event) => setInvite((prev) => ({ ...prev, role: event.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={inviting}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
            >
              {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
              {inviting ? 'Invitando…' : 'Enviar invitación'}
            </button>
          </form>
        </div>
      )}

      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <form
            onSubmit={createKey}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-purple-100 p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-space text-lg font-bold text-slate-900">Nueva API key</h2>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Nombre de la clave
            </label>
            <input
              value={newKeyName}
              onChange={(event) => setNewKeyName(event.target.value.slice(0, 40))}
              placeholder="Ej: Producción backend"
              className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
            />
            <button
              type="submit"
              disabled={creatingKey}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
            >
              {creatingKey && <Loader2 className="w-4 h-4 animate-spin" />}
              {creatingKey ? 'Creando…' : 'Crear clave'}
            </button>
          </form>
        </div>
      )}

      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-purple-100 p-5">
            <h2 className="font-space text-lg font-bold text-slate-900">Guardá tu clave ahora</h2>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">
              No se vuelve a mostrar completa. Copiala y guardala en un lugar seguro.
            </p>
            <div className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono-code text-[11px] break-all">
              {createdKey}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={copyCreatedKey}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-2"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? 'Copiada' : 'Copiar clave'}
              </button>
              <button
                onClick={() => setCreatedKey('')}
                className="px-4 py-2.5 rounded-xl border border-purple-200 text-slate-700 text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
