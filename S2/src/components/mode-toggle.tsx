import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/theme-provider"
import type { Theme } from "@/components/theme-provider"

const themes: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

export function ModeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const ThemeIcon = theme === "system" ? MonitorIcon : resolvedTheme === "dark" ? MoonIcon : SunIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" className="size-9" />}
        aria-label={`Change theme. Current theme: ${theme}`}
      >
        <ThemeIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as Theme)}
        >
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          {themes.map((item) => (
            <DropdownMenuRadioItem
              key={item.value}
              value={item.value}
              className="focus:outline-2 focus:outline-offset-2 focus:outline-ring focus:ring-2 focus:ring-ring"
            >
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
