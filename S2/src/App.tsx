import { useEffect, useState } from "react";
import { LayersIcon, MoonIcon, SunIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function App() {
  const [dark, setDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 font-semibold">
            <LayersIcon className="size-5" />
            <span>Workspace</span>
            <Badge variant="secondary">Starter</Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDark(!dark)}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-6 py-10 sm:py-14">
        <div className="space-y-3">
          <Badge variant="outline">Tauri + React + shadcn/ui</Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Make yourself at home.
          </h1>
          <p className="max-w-xl text-muted-foreground">
            A simple starting point for your desktop app. Explore the components,
            adjust the theme, and start building.
          </p>
        </div>

        <Tabs defaultValue="overview" className="gap-6">
          <TabsList aria-label="Workspace sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid items-start gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>A little introduction</CardTitle>
                  <CardDescription>
                    Try out a form built with shadcn components.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setMessage(`Welcome, ${name.trim()}! Your workspace is ready.`);
                    }}
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="name">Your name</Label>
                      <Input
                        id="name"
                        placeholder="Alex Morgan"
                        autoComplete="given-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={!name.trim()}>Say hello</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setName("");
                          setMessage("");
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                    <p role="status" className="min-h-5 text-sm text-muted-foreground">
                      {message}
                    </p>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ready to build</CardTitle>
                  <CardDescription>The essentials are in place.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {[
                    ["Components", "shadcn/ui with Base UI primitives"],
                    ["Styling", "Tailwind CSS v4 with a neutral theme"],
                    ["React Compiler", "Automatic memoization through Babel"],
                  ].map(([title, description]) => (
                    <div key={title} className="space-y-1">
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                  ))}
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Start editing <code className="font-mono">src/App.tsx</code> to make it yours.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Choose a look for this session.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="dark-mode">Dark mode</Label>
                  <p id="dark-mode-description" className="text-sm text-muted-foreground">
                    Give your workspace a darker background.
                  </p>
                </div>
                <Switch
                  id="dark-mode"
                  aria-describedby="dark-mode-description"
                  checked={dark}
                  onCheckedChange={setDark}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
