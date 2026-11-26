"use client";
import { usePathname } from "next/navigation";
import TopNav from "../TopNav";
import s from "./app.module.css";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={s.shell}>
      <TopNav />
      <div key={`laser:${pathname}`} className="page-laser" aria-hidden />
      <main key={pathname} className={`${s.content} page-enter`}>
        {children}
      </main>
    </div>
  );
}
