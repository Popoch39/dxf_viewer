import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthFormSkeletonProps {
  /** Labels of the form's fields, in order. */
  fields: readonly string[];
}

/**
 * Stand-in for the login or register form while the Session is checked. It keeps
 * the form's layout, reserved error lines included, so nothing moves once the form shows.
 */
export function AuthFormSkeleton({ fields }: AuthFormSkeletonProps) {
  return (
    <output aria-label="Chargement" className="block">
      <FieldGroup>
        {fields.map((label) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="text-sm leading-snug font-medium">{label}</span>
            <Skeleton className="h-8" />
            <div className="-mt-1 h-4" />
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8" />
          <div className="h-5" />
        </div>
      </FieldGroup>
    </output>
  );
}
