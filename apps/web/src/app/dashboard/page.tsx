"use client";

import Image from "next/image";
import { useActionState } from "react";

import { logout } from "@/lib/dashboard-auth";

import SureWalkLogo from "../../../public/sure-walk.png";

const Dashboard = () => {
  const [, action, pending] = useActionState(logout, undefined);

  return (
    <>
      <header className="py-4 full-width flex flex-row items-center justify-between border-b border-gray-200">
        <Image src={SureWalkLogo} alt="Sure Walk Logo" height={32} />
        <form action={action}>
          <button className="cursor-pointer" disabled={pending} type="submit">
            Log out
          </button>
        </form>
      </header>
      <main className="full-width h-full flex-1"></main>
    </>
  );
};

export default Dashboard;
