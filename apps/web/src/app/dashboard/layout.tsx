import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifySession } from "@/lib/dashboard-auth";

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const cookie = (await cookies()).get("session")?.value;
  const session = await verifySession(cookie ?? "");

  if (!session.valid) {
    redirect("/");
  }

  return <div className="bg-blue">{children}</div>;
};

export default Layout;
