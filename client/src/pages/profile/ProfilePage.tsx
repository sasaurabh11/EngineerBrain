import { useEffect, useState, type FormEvent } from "react";
import { useMe, useUpdateMe } from "../../hooks/useMe";

export function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const updateMe = useUpdateMe();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me) setName(me.name);
  }, [me]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await updateMe.mutateAsync(name);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  }

  if (isLoading || !me) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Your profile</h1>
      <div className="mb-6 flex items-center gap-3 rounded border border-gray-200 bg-white p-4">
        {me.profileImage && <img src={me.profileImage} alt="" className="h-12 w-12 rounded-full" />}
        <div>
          <p className="text-sm font-medium text-gray-900">{me.name}</p>
          <p className="text-xs text-gray-500">{me.email}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="rounded border border-gray-200 bg-white p-4">
        <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="profile-name">
          Display name
        </label>
        <input
          id="profile-name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mb-3 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {saved && <p className="mb-3 text-sm text-green-600">Saved.</p>}
        <button
          type="submit"
          disabled={updateMe.isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {updateMe.isPending ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
