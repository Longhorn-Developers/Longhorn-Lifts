"use client";

import { useActionState, useEffect, useState } from "react";

import { login } from "@/lib/dashboard-auth";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, action, pending] = useActionState(login, undefined);

  useEffect(() => {
    if (state?.message) {
      // invalid email / password
      alert(state.message);
    }
  }, [state]);

  const formInput = "flex flex-col gap-1";
  const textInput = "p-2 bg-gray-50 border border-gray-200 rounded-lg";
  const errors = "text-red-400";
  const primaryButton =
    "bg-ut-burntorange text-white rounded-full p-2.5 text-lg mt-2 cursor-pointer";

  return (
    <div className="bg-ut-burntorange flex-1 grid place-items-center">
      <div className="p-5 bg-background rounded-xl min-w-full min-[24rem]:min-w-96">
        <form action={action} className="flex flex-col gap-4">
          <h1 className="text-3xl font-medium">Login</h1>
          <div className={formInput}>
            <label htmlFor="email">Email</label>
            <input
              className={textInput}
              id="email"
              name="email"
              placeholder="bevo@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {state?.errors?.email && (
              <p className={errors}>{state.errors.email}</p>
            )}
          </div>

          <div className={formInput}>
            <label htmlFor="password">Password</label>
            <input
              className={textInput}
              id="password"
              name="password"
              type="password"
              placeholder="••••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {state?.errors?.password && (
              <p className={errors}>{state.errors.password}</p>
            )}
          </div>

          <button className={primaryButton} disabled={pending} type="submit">
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}
