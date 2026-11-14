import TopNav from "../TopNav";
import s from "./app.module.css";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.shell}>
      <TopNav />
      <main className={s.content}>{children}</main>
    </div>
  );
}
