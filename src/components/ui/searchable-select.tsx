"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allLabel?: string
  className?: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  allLabel,
  className,
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])

  const filtered = useMemo(
    () => query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options,
    [options, query]
  )

  const allItems = useMemo<SelectOption[]>(() => [
    ...(allLabel ? [{ value: "", label: allLabel }] : []),
    ...filtered,
  ], [allLabel, filtered])

  useEffect(() => { setHighlightedIndex(-1) }, [query])

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return
    const item = listRef.current.children[highlightedIndex] as HTMLElement
    item?.scrollIntoView({ block: "nearest" })
  }, [highlightedIndex])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()

    function handleOutside(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery("")
      }
    }

    function handleScroll() {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    }

    document.addEventListener("mousedown", handleOutside)
    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("resize", handleScroll)
    return () => {
      document.removeEventListener("mousedown", handleOutside)
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleScroll)
    }
  }, [open])

  const openDropdown = useCallback(() => {
    if (disabled) return
    const r = triggerRef.current?.getBoundingClientRect()
    setRect(r ?? null)
    setOpen(true)
    setHighlightedIndex(-1)
  }, [disabled])

  const select = useCallback((val: string) => {
    onChange(val)
    setOpen(false)
    setQuery("")
    setHighlightedIndex(-1)
  }, [onChange])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0) select(allItems[highlightedIndex].value)
    } else if (e.key === "Escape") {
      setOpen(false)
      setQuery("")
    }
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      open ? setOpen(false) : openDropdown()
    }
  }

  const displayLabel = selected?.label ?? (allLabel && !value ? allLabel : undefined)

  const dropdown = open && rect && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 220),
            zIndex: 9999,
          }}
          className="rounded-lg border border-border bg-popover shadow-md text-popover-foreground"
        >
          <div className="p-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar..."
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
            {allItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados</p>
            ) : (
              allItems.map((o, i) => (
                <button
                  key={o.value === "" ? "__all__" : o.value}
                  type="button"
                  onClick={() => select(o.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    (o.value === value || (o.value === "" && !value)) && "bg-accent text-accent-foreground",
                    i === highlightedIndex && "ring-1 ring-ring/50 bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      (o.value === value || (o.value === "" && !value)) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openDropdown()}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent pl-2.5 pr-2 text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !displayLabel && "text-muted-foreground"
        )}
      >
        <span className="flex-1 truncate text-left">
          {displayLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {dropdown}
    </div>
  )
}
