import { useState, type FormEvent } from "react";
import { setPassword } from "../lib/api.js";
import { Button, Card, Input } from "./primitives.js";

interface Props {
  onAuthenticated: () => void;
}

export function LoginGate({ onAuthenticated }: Props) {
  const [pw, setPw] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pw) return;
    setPassword(pw);
    onAuthenticated();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card
        title="code-server-ops"
        description="Enter the agent password to continue."
        className="w-full max-w-sm"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="CSOPS_PASSWORD"
            autoFocus
          />
          <Button type="submit">Sign in</Button>
          <p className="text-xs text-zinc-500">
            The password is stored in this browser tab only (sessionStorage).
          </p>
        </form>
      </Card>
    </div>
  );
}
