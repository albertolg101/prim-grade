import * as React from "react"
import { cn } from "@/lib/utils"

// field-sizing-content grows the field to fit its text; where it is missing (older Safari,
// Firefox) the height follows the text from script instead
const fitByScript = typeof CSS !== "undefined" && !CSS.supports("field-sizing", "content")

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!fitByScript || !el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [props.value])
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
