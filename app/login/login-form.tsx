"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};
export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  return <form action={action} className="login-form">
    <div className="form-field"><label htmlFor="email">Email address</label><input className="field" id="email" name="email" type="email" autoComplete="username" required /></div>
    <div className="form-field"><label htmlFor="password">Password</label><input className="field" id="password" name="password" type="password" autoComplete="current-password" required /></div>
    {state.error && <p className="error-text" role="alert">{state.error}</p>}
    <button className="button" disabled={pending}>{pending ? "Signing in…" : "Sign in securely"}</button>
  </form>;
}
