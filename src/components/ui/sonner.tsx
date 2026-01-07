'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        // Compact toast styling
        style: {
          padding: '8px 12px',
          fontSize: '13px',
          minHeight: 'auto',
          maxWidth: '280px',
        },
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-zinc-900 group-[.toaster]:text-zinc-100 group-[.toaster]:border-zinc-700 group-[.toaster]:shadow-md',
          title: 'group-[.toast]:text-zinc-100 group-[.toast]:font-medium group-[.toast]:text-sm',
          description: 'group-[.toast]:text-zinc-400 group-[.toast]:text-xs',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success: 'group-[.toaster]:bg-emerald-900 group-[.toaster]:text-emerald-100 group-[.toaster]:border-emerald-700',
          error: 'group-[.toaster]:bg-red-900 group-[.toaster]:text-red-100 group-[.toaster]:border-red-700',
          loading: 'group-[.toaster]:bg-zinc-800 group-[.toaster]:text-zinc-100 group-[.toaster]:border-zinc-600',
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
