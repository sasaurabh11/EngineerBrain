import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMe, useUpdateAiSettings, useUpdateMe } from "../../hooks/useMe";
import type { AiProvider, UserProfile } from "../../types/user.types";

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

const AI_PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "GEMINI", label: "Gemini" },
  { value: "GROQ", label: "Groq" },
];

function ApiKeyField({
  label,
  hasKey,
  value,
  onChange,
  onRemove,
  removing,
}: {
  label: string;
  hasKey: boolean;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {hasKey && <Badge variant="secondary">Key set</Badge>}
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          placeholder={hasKey ? "Enter a new key to replace it" : "Leave blank to use the app's default key"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
        />
        {hasKey && (
          <Button type="button" variant="outline" onClick={onRemove} disabled={removing}>
            {removing && <Loader2 className="animate-spin" />}
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function AiSettingsForm({ me }: { me: UserProfile }) {
  const updateAiSettings = useUpdateAiSettings();
  const [provider, setProvider] = useState<AiProvider>(me.aiProvider);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [removingKey, setRemovingKey] = useState<"gemini" | "groq" | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await updateAiSettings.mutateAsync({
        provider: provider !== me.aiProvider ? provider : undefined,
        geminiApiKey: geminiApiKey.trim() ? geminiApiKey.trim() : undefined,
        groqApiKey: groqApiKey.trim() ? groqApiKey.trim() : undefined,
      });
      setGeminiApiKey("");
      setGroqApiKey("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update AI settings");
    }
  }

  async function handleRemoveKey(key: "gemini" | "groq") {
    setError(null);
    setSaved(false);
    setRemovingKey(key);
    try {
      await updateAiSettings.mutateAsync(key === "gemini" ? { geminiApiKey: null } : { groqApiKey: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove key");
    } finally {
      setRemovingKey(null);
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">AI settings</h2>
            <p className="text-xs text-muted-foreground">
              Choose which AI provider powers chat, autonomous tasks, and repository analysis for you.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ApiKeyField
            label="Gemini API key"
            hasKey={me.hasGeminiKey}
            value={geminiApiKey}
            onChange={setGeminiApiKey}
            onRemove={() => handleRemoveKey("gemini")}
            removing={removingKey === "gemini"}
          />

          <ApiKeyField
            label="Groq API key"
            hasKey={me.hasGroqKey}
            value={groqApiKey}
            onChange={setGroqApiKey}
            onRemove={() => handleRemoveKey("groq")}
            removing={removingKey === "groq"}
          />

          <p className="text-xs text-muted-foreground">
            Your keys are encrypted at rest and never shown again after saving. Leave a key field blank to keep using
            the app's shared default key for that provider.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-success">Saved.</p>}
          <Button type="submit" disabled={updateAiSettings.isPending}>
            {updateAiSettings.isPending && <Loader2 className="animate-spin" />}
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
      <AiSettingsForm key={`${me.email}-ai`} me={me} />
    </div>
  );
}
