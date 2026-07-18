import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMe, useUpdateMe } from "../../hooks/useMe";
import type { UserProfile } from "../../types/user.types";

function ProfileForm({ me }: { me: UserProfile }) {
  const updateMe = useUpdateMe();
  const [name, setName] = useState(me.name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-name">
              Display name
            </label>
            <Input id="profile-name" type="text" required value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-success">Saved.</p>}
          <Button type="submit" disabled={updateMe.isPending}>
            {updateMe.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ProfilePage() {
  const { data: me, isLoading } = useMe();

  if (isLoading || !me) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading profile…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 animate-fade-up">
      <h1 className="text-xl font-semibold text-foreground">Your profile</h1>
      <Card>
        <CardContent className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage src={me.profileImage ?? undefined} alt={me.name} />
            <AvatarFallback>{me.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{me.name}</p>
            <p className="text-xs text-muted-foreground">{me.email}</p>
          </div>
        </CardContent>
      </Card>

      <ProfileForm key={me.email} me={me} />
    </div>
  );
}
