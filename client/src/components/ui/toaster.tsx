import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast() //list of active toasts from the hook 

  return (
    <ToastProvider> // enables toast
      {toasts.map(function ({ id, title, description, action, ...props }) { // loop through each toast and render it
        return (
          <Toast key={id} {...props}> // container for the toast
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action} // optional action button
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport /> // positions toast on screen
    </ToastProvider>
  )
}
