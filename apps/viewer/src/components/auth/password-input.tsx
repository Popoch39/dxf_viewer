import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A password field whose content can be shown, instead of a confirmation field. */
export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-9" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute inset-y-0.5 right-0.5 my-auto"
        // A toggle keeps one label: `aria-pressed` tells whether it is on.
        aria-label="Afficher le mot de passe"
        aria-pressed={visible}
        onClick={() => {
          setVisible(!visible);
        }}
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
    </div>
  );
}
