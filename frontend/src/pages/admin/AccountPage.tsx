import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiErrorMessage } from "../../api/client";

export function AccountPage() {
  const { user, updateMe } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileNotice(null);
    const emailChanged = email !== user?.email;
    if (emailChanged && !currentPassword) {
      setProfileError("Para cambiar el email, introduce tu contraseña actual abajo, en el bloque de contraseña.");
      return;
    }
    setSavingProfile(true);
    try {
      await updateMe({
        name: name !== user?.name ? name : undefined,
        email: emailChanged ? email : undefined,
        currentPassword: emailChanged ? currentPassword : undefined,
      });
      setProfileNotice("Datos actualizados correctamente.");
      setCurrentPassword("");
    } catch (err) {
      setProfileError(apiErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordNotice(null);
    if (newPassword.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    setSavingPassword(true);
    try {
      await updateMe({ currentPassword, newPassword });
      setPasswordNotice("Contraseña actualizada correctamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(apiErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold text-slate-800 mb-6">Mi cuenta</h1>

      <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Datos de la cuenta</h2>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          {email !== user?.email && (
            <p className="text-xs text-amber-600 mt-1">
              Para confirmar el cambio de email, introduce tu contraseña actual justo debajo.
            </p>
          )}
        </div>
        {email !== user?.email && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Contraseña actual (para confirmar el email)</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        )}
        {profileError && <p className="text-sm text-red-600">{profileError}</p>}
        {profileNotice && <p className="text-sm text-emerald-600">{profileNotice}</p>}
        <button
          type="submit"
          disabled={savingProfile}
          className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {savingProfile ? "Guardando..." : "Guardar datos"}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Cambiar contraseña</h2>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Contraseña actual</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Nueva contraseña</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Repite la nueva contraseña</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
        {passwordNotice && <p className="text-sm text-emerald-600">{passwordNotice}</p>}
        <button
          type="submit"
          disabled={savingPassword}
          className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {savingPassword ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
