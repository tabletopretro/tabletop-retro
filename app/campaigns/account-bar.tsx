import { signOut } from "@/app/auth-actions";
import type { CurrentUser } from "@/lib/auth/dal";
import ui from "../ui.module.css";
import styles from "./account-bar.module.css";
import { JoinTablePopover } from "./join-table-popover";

export function AccountBar({ user }: { user: CurrentUser }) {
  return (
    <div className={styles.bar}>
      <span className={styles.name}>{user.name}</span>
      <JoinTablePopover />
      <form action={signOut}>
        <button type="submit" className={ui.quiet}>
          Sign out
        </button>
      </form>
    </div>
  );
}
