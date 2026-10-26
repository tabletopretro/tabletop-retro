import { EyeOffIcon } from "./icons";
import styles from "./private-hint.module.css";
import { Tooltip } from "./tooltip";

export function PrivateHint({ label = "Only you see these" }: { label?: string }) {
  return (
    <Tooltip content={label}>
      <span className={styles.hint} role="img" aria-label={label} tabIndex={0}>
        <EyeOffIcon size={14} />
      </span>
    </Tooltip>
  );
}
